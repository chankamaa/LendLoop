import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const toolCategoryValidator = v.union(
  v.literal("Power Tools"),
  v.literal("Garden"),
  v.literal("Kitchen"),
  v.literal("Camping"),
  v.literal("Electronics"),
  v.literal("Other")
);

export const toolConditionValidator = v.union(
  v.literal("Like New"),
  v.literal("Good"),
  v.literal("Fair")
);

export const toolStatusValidator = v.union(
  v.literal("available"),
  v.literal("borrowed")
);

export const loanStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned")
);

export const userRoleValidator = v.union(
  v.literal("admin"),
  v.literal("user")
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    role: userRoleValidator,
    isTrustedLender: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  tools: defineTable({
    name: v.string(),
    category: toolCategoryValidator,
    condition: toolConditionValidator,
    description: v.string(),
    ownerId: v.id("users"),
    status: toolStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_category", ["category"]),

  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    status: loanStatusValidator,
    note: v.optional(v.string()),
    overdueReminderSentAt: v.optional(v.number()),
    lastAutomationEvent: v.optional(
      v.object({
        type: v.string(),
        message: v.string(),
        timestamp: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tool", ["toolId"])
    .index("by_owner", ["ownerId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_status", ["status"]),

  automationIdempotency: defineTable({
    idempotencyKey: v.string(),
    loanId: v.id("loans"),
    workflow: v.string(),
    message: v.string(),
    processedAt: v.number(),
  })
    .index("by_key", ["idempotencyKey"])
    .index("by_loan", ["loanId"]),
});
