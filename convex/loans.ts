import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertOwner, requireAdmin, requireUser } from "./lib/auth";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateDateRange(startDate: string, endDate: string): void {
  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
    throw new Error("Dates must be in YYYY-MM-DD format.");
  }
  if (endDate < startDate) {
    throw new Error("End date must be on or after the start date.");
  }
}

/**
 * AUTHENTICATED mutation: Request to borrow an available tool.
 */
export const requestBorrow = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const borrower = await requireUser(ctx);
    validateDateRange(args.startDate, args.endDate);

    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new Error("Tool not found.");
    }
    if (tool.status !== "available") {
      throw new Error("This tool is currently borrowed and unavailable.");
    }
    if (tool.ownerId === borrower._id) {
      throw new Error("You cannot request to borrow your own tool.");
    }

    // Prevent duplicate pending request from the same borrower on the same tool
    const existingLoans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect();

    const duplicatePending = existingLoans.find(
      (l) => l.borrowerId === borrower._id && l.status === "pending"
    );
    if (duplicatePending) {
      throw new Error("You already have a pending request for this tool.");
    }

    const owner = await ctx.db.get(tool.ownerId);
    const now = Date.now();

    const loanId = await ctx.db.insert("loans", {
      toolId: tool._id,
      ownerId: tool.ownerId,
      borrowerId: borrower._id,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      note: args.note?.trim() ? args.note.trim().slice(0, 300) : undefined,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.automation.notifyLoanEvent, {
      loanId,
      event: "created",
      toolName: tool.name,
      borrowerName: borrower.name,
      ownerName: owner?.name ?? "Owner",
      startDate: args.startDate,
      endDate: args.endDate,
    });

    return loanId;
  },
});

/**
 * OWNER-ONLY mutation: Approve a pending borrow request.
 * Marks tool as "borrowed" and auto-declines other pending requests for the same tool.
 */
export const approveRequest = mutation({
  args: {
    loanId: v.id("loans"),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan request not found.");
    }

    assertOwner(owner, loan.ownerId, "borrow request");

    if (loan.status !== "pending") {
      throw new Error(`Cannot approve a request with status "${loan.status}".`);
    }

    const tool = await ctx.db.get(loan.toolId);
    if (!tool) {
      throw new Error("Associated tool no longer exists.");
    }
    if (tool.status !== "available") {
      throw new Error("This tool is already marked as borrowed.");
    }

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "approved",
      updatedAt: now,
    });
    await ctx.db.patch(tool._id, {
      status: "borrowed",
      updatedAt: now,
    });

    // Auto-decline competing pending requests for the same tool
    const otherLoans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect();

    for (const other of otherLoans) {
      if (other._id !== loan._id && other.status === "pending") {
        await ctx.db.patch(other._id, {
          status: "declined",
          updatedAt: now,
        });
      }
    }

    const borrower = await ctx.db.get(loan.borrowerId);
    await ctx.scheduler.runAfter(0, internal.automation.notifyLoanEvent, {
      loanId: loan._id,
      event: "approved",
      toolName: tool.name,
      borrowerName: borrower?.name ?? "Borrower",
      ownerName: owner.name,
      startDate: loan.startDate,
      endDate: loan.endDate,
    });

    return { status: "approved" };
  },
});

/**
 * OWNER-ONLY mutation: Decline a pending borrow request. Tool stays available.
 */
export const declineRequest = mutation({
  args: {
    loanId: v.id("loans"),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan request not found.");
    }

    assertOwner(owner, loan.ownerId, "borrow request");

    if (loan.status !== "pending") {
      throw new Error(`Cannot decline a request with status "${loan.status}".`);
    }

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "declined",
      updatedAt: now,
    });

    const [tool, borrower] = await Promise.all([
      ctx.db.get(loan.toolId),
      ctx.db.get(loan.borrowerId),
    ]);

    await ctx.scheduler.runAfter(0, internal.automation.notifyLoanEvent, {
      loanId: loan._id,
      event: "declined",
      toolName: tool?.name ?? "Tool",
      borrowerName: borrower?.name ?? "Borrower",
      ownerName: owner.name,
      startDate: loan.startDate,
      endDate: loan.endDate,
    });

    return { status: "declined" };
  },
});

/**
 * OWNER-ONLY mutation: Mark an approved loan as returned. Tool becomes available again.
 */
export const markReturned = mutation({
  args: {
    loanId: v.id("loans"),
  },
  handler: async (ctx, args) => {
    const owner = await requireUser(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found.");
    }

    assertOwner(owner, loan.ownerId, "loan");

    if (loan.status !== "approved") {
      throw new Error("Only active approved loans can be marked as returned.");
    }

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "returned",
      updatedAt: now,
    });

    const tool = await ctx.db.get(loan.toolId);
    if (tool) {
      await ctx.db.patch(tool._id, {
        status: "available",
        updatedAt: now,
      });
    }

    const borrower = await ctx.db.get(loan.borrowerId);
    await ctx.scheduler.runAfter(0, internal.automation.notifyLoanEvent, {
      loanId: loan._id,
      event: "returned",
      toolName: tool?.name ?? "Tool",
      borrowerName: borrower?.name ?? "Borrower",
      ownerName: owner.name,
      startDate: loan.startDate,
      endDate: loan.endDate,
    });

    return { status: "returned" };
  },
});

/**
 * AUTHENTICATED query: Loans requested by the signed-in borrower.
 */
export const listMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      loans.map(async (loan) => {
        const [tool, owner] = await Promise.all([
          ctx.db.get(loan.toolId),
          ctx.db.get(loan.ownerId),
        ]);
        return {
          _id: loan._id,
          toolId: loan.toolId,
          toolName: tool?.name ?? "(Removed listing)",
          toolCategory: tool?.category ?? "Other",
          ownerName: owner?.name ?? "Neighbor",
          ownerIsTrustedLender: owner?.isTrustedLender ?? false,
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
          note: loan.note,
          overdueReminderSentAt: loan.overdueReminderSentAt,
          lastAutomationEvent: loan.lastAutomationEvent,
          createdAt: loan.createdAt,
        };
      })
    );
  },
});

/**
 * AUTHENTICATED query: Incoming borrow requests for tools owned by the signed-in user.
 */
export const listIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();

    return await Promise.all(
      loans.map(async (loan) => {
        const [tool, borrower] = await Promise.all([
          ctx.db.get(loan.toolId),
          ctx.db.get(loan.borrowerId),
        ]);
        return {
          _id: loan._id,
          toolId: loan.toolId,
          toolName: tool?.name ?? "(Removed listing)",
          toolCategory: tool?.category ?? "Other",
          borrowerName: borrower?.name ?? "Neighbor",
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
          note: loan.note,
          overdueReminderSentAt: loan.overdueReminderSentAt,
          lastAutomationEvent: loan.lastAutomationEvent,
          createdAt: loan.createdAt,
        };
      })
    );
  },
});

/**
 * ADMIN-ONLY query: View all loans across the entire platform.
 */
export const listAllLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").order("desc").collect();

    return await Promise.all(
      loans.map(async (loan) => {
        const [tool, owner, borrower] = await Promise.all([
          ctx.db.get(loan.toolId),
          ctx.db.get(loan.ownerId),
          ctx.db.get(loan.borrowerId),
        ]);
        return {
          _id: loan._id,
          toolId: loan.toolId,
          toolName: tool?.name ?? "(Removed listing)",
          toolCategory: tool?.category ?? "Other",
          ownerName: owner?.name ?? "Unknown",
          borrowerName: borrower?.name ?? "Unknown",
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
          note: loan.note,
          overdueReminderSentAt: loan.overdueReminderSentAt,
          lastAutomationEvent: loan.lastAutomationEvent,
          createdAt: loan.createdAt,
        };
      })
    );
  },
});
