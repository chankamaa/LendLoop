import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { signHmacSha256 } from "./lib/hmac";

/**
 * Outbound webhook: Dispatches a data-minimized, HMAC-SHA256 signed loan
 * lifecycle event to n8n Workflow 1.
 */
export const notifyLoanEvent = internalAction({
  args: {
    loanId: v.id("loans"),
    event: v.union(
      v.literal("created"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("returned")
    ),
    toolName: v.string(),
    borrowerName: v.string(),
    ownerName: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (_ctx, args) => {
    const webhookUrl = process.env.N8N_REQUEST_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      console.log(
        `[automation:notifyLoanEvent] Skipping n8n dispatch (N8N_REQUEST_WEBHOOK_URL or N8N_WEBHOOK_SECRET not set). Event=${args.event} LoanId=${args.loanId}`
      );
      return { dispatched: false, reason: "n8n_not_configured" };
    }

    const timestamp = Date.now();
    // Data-minimized payload: no emails, clerkIds, roles, or full user objects
    const payload = JSON.stringify({
      loanId: args.loanId,
      event: args.event,
      toolName: args.toolName,
      borrowerName: args.borrowerName,
      ownerName: args.ownerName,
      startDate: args.startDate,
      endDate: args.endDate,
      idempotencyKey: `${args.loanId}:${args.event}:${timestamp}`,
      timestamp,
    });

    const signature = await signHmacSha256(payload, webhookSecret);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signature,
      },
      body: payload,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[automation:notifyLoanEvent] n8n webhook failed (${response.status}): ${errorText}`
      );
      return { dispatched: false, status: response.status };
    }

    return { dispatched: true, status: response.status };
  },
});

/**
 * Inbound callback (Workflow 1): Idempotently records lastAutomationEvent on a loan.
 */
export const recordAutomationEvent = internalMutation({
  args: {
    loanId: v.id("loans"),
    idempotencyKey: v.string(),
    eventType: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Idempotency check
    const existing = await ctx.db
      .query("automationIdempotency")
      .withIndex("by_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();

    if (existing) {
      return { ok: true, deduplicated: true };
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return { ok: false, error: "Loan not found" };
    }

    const now = Date.now();

    await ctx.db.insert("automationIdempotency", {
      idempotencyKey: args.idempotencyKey,
      loanId: loan._id,
      workflow: "request-notification",
      message: args.message,
      processedAt: now,
    });

    await ctx.db.patch(loan._id, {
      lastAutomationEvent: {
        type: args.eventType,
        message: args.message,
        timestamp: now,
      },
      updatedAt: now,
    });

    return { ok: true, deduplicated: false };
  },
});

/**
 * Inbound query (Workflow 2): Returns active approved loans past their endDate
 * where overdueReminderSentAt is still unset. Data-minimized payload.
 */
export const getOverdueLoans = internalQuery({
  args: {
    todayIso: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const approvedLoans = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const overdueLoans = approvedLoans.filter(
      (loan) =>
        loan.endDate < args.todayIso && loan.overdueReminderSentAt === undefined
    );

    return await Promise.all(
      overdueLoans.map(async (loan) => {
        const [tool, borrower, owner] = await Promise.all([
          ctx.db.get(loan.toolId),
          ctx.db.get(loan.borrowerId),
          ctx.db.get(loan.ownerId),
        ]);

        const msPerDay = 86_400_000;
        const daysOverdue = Math.max(
          1,
          Math.floor(
            (Date.parse(args.todayIso) - Date.parse(loan.endDate)) / msPerDay
          )
        );

        return {
          loanId: loan._id,
          toolName: tool?.name ?? "Borrowed tool",
          borrowerName: borrower?.name ?? "Neighbor",
          ownerName: owner?.name ?? "Owner",
          endDate: loan.endDate,
          daysOverdue,
          idempotencyKey: `${loan._id}:${args.todayIso}`,
        };
      })
    );
  },
});

/**
 * Inbound callback (Workflow 2): Idempotently marks overdueReminderSentAt
 * and updates lastAutomationEvent. Double-guarded by idempotencyKey AND
 * loan.overdueReminderSentAt so retries never duplicate reminders/logs.
 */
export const markOverdueReminderSent = internalMutation({
  args: {
    loanId: v.id("loans"),
    idempotencyKey: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Guard 1: Idempotency key check (loanId + date)
    const existing = await ctx.db
      .query("automationIdempotency")
      .withIndex("by_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .unique();

    if (existing) {
      return { ok: true, deduplicated: true, reason: "idempotency_key_exists" };
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return { ok: false, error: "Loan not found" };
    }

    // Guard 2: Loan-level overdueReminderSentAt check
    if (loan.overdueReminderSentAt !== undefined) {
      return {
        ok: true,
        deduplicated: true,
        reason: "overdue_reminder_already_sent",
      };
    }

    const now = Date.now();
    const eventMessage = args.message ?? "Overdue reminder sent";

    await ctx.db.insert("automationIdempotency", {
      idempotencyKey: args.idempotencyKey,
      loanId: loan._id,
      workflow: "overdue-reminders",
      message: eventMessage,
      processedAt: now,
    });

    await ctx.db.patch(loan._id, {
      overdueReminderSentAt: now,
      lastAutomationEvent: {
        type: "overdue_reminder",
        message: eventMessage,
        timestamp: now,
      },
      updatedAt: now,
    });

    return { ok: true, deduplicated: false };
  },
});
