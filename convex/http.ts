import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { verifyBearerSecret, verifyHmacSha256 } from "./lib/hmac";

const http = httpRouter();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getTodayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/automation-callback
 * Called by n8n Workflow 1 after processing a loan notification.
 * Strictly verifies HMAC-SHA256 (`X-Hub-Signature-256`) using N8N_WEBHOOK_SECRET.
 */
http.route({
  path: "/api/automation-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!secret) {
      return jsonResponse(
        { error: "Server misconfiguration: N8N_WEBHOOK_SECRET not set" },
        500
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("X-Hub-Signature-256");

    const valid = await verifyHmacSha256(rawBody, signature, secret);
    if (!valid) {
      return jsonResponse({ error: "Invalid HMAC signature" }, 401);
    }

    let parsed: {
      loanId?: string;
      idempotencyKey?: string;
      eventType?: string;
      message?: string;
    };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!parsed.loanId || !parsed.idempotencyKey || !parsed.message) {
      return jsonResponse(
        { error: "Missing required fields: loanId, idempotencyKey, message" },
        400
      );
    }

    const result = await ctx.runMutation(
      internal.automation.recordAutomationEvent,
      {
        loanId: parsed.loanId as Id<"loans">,
        idempotencyKey: parsed.idempotencyKey,
        eventType: parsed.eventType ?? "request_notification",
        message: parsed.message,
      }
    );

    if (!result.ok) {
      return jsonResponse(result, 404);
    }

    return jsonResponse(result, 200);
  }),
});

/**
 * GET /api/overdue-loans
 * Called by n8n Workflow 2 (daily schedule or manual trigger).
 * Verified via constant-time Bearer secret (`Authorization: Bearer <N8N_WEBHOOK_SECRET>`).
 */
http.route({
  path: "/api/overdue-loans",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!secret) {
      return jsonResponse(
        { error: "Server misconfiguration: N8N_WEBHOOK_SECRET not set" },
        500
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (!verifyBearerSecret(authHeader, secret)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const todayIso = getTodayUtcIso();
    const overdueLoans = await ctx.runQuery(
      internal.automation.getOverdueLoans,
      { todayIso }
    );

    return jsonResponse({
      date: todayIso,
      count: overdueLoans.length,
      loans: overdueLoans,
    });
  }),
});

/**
 * POST /api/mark-reminder-sent
 * Called by n8n Workflow 2 after sending each overdue reminder.
 * Strictly verifies HMAC-SHA256 (`X-Hub-Signature-256`) and enforces idempotency.
 */
http.route({
  path: "/api/mark-reminder-sent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!secret) {
      return jsonResponse(
        { error: "Server misconfiguration: N8N_WEBHOOK_SECRET not set" },
        500
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("X-Hub-Signature-256");

    const valid = await verifyHmacSha256(rawBody, signature, secret);
    if (!valid) {
      return jsonResponse({ error: "Invalid HMAC signature" }, 401);
    }

    let parsed: {
      loanId?: string;
      idempotencyKey?: string;
      message?: string;
    };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!parsed.loanId || !parsed.idempotencyKey) {
      return jsonResponse(
        { error: "Missing required fields: loanId, idempotencyKey" },
        400
      );
    }

    const result = await ctx.runMutation(
      internal.automation.markOverdueReminderSent,
      {
        loanId: parsed.loanId as Id<"loans">,
        idempotencyKey: parsed.idempotencyKey,
        message: parsed.message,
      }
    );

    if (!result.ok) {
      return jsonResponse(result, 404);
    }

    return jsonResponse(result, 200);
  }),
});

export default http;
