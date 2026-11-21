import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  toolCategoryValidator,
  toolConditionValidator,
} from "./schema";
import {
  assertOwner,
  assertOwnerOrAdmin,
  requireUser,
} from "./lib/auth";

/**
 * PUBLIC (Unauthenticated-safe) query.
 * Privacy guarantee: returns ONLY available tools with ONLY _id, name, and category.
 * Strictly hides ownerId, owner name, description, and condition.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const availableTools = await ctx.db
      .query("tools")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .order("desc")
      .collect();

    return availableTools.map((tool) => ({
      _id: tool._id,
      name: tool.name,
      category: tool.category,
    }));
  },
});

/**
 * AUTHENTICATED query: Browse all tools with availability, condition,
 * description, and owner display info (Trusted Lender badge, no email leaked).
 */
export const listAll = query({
  args: {
    category: v.optional(toolCategoryValidator),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireUser(ctx);

    const tools = args.category
      ? await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", args.category!))
          .order("desc")
          .collect()
      : await ctx.db.query("tools").order("desc").collect();

    const ownerIds = Array.from(new Set(tools.map((t) => t.ownerId)));
    const owners = await Promise.all(ownerIds.map((id) => ctx.db.get(id)));
    const ownerMap = new Map(
      owners.filter(Boolean).map((u) => [u!._id, u!])
    );

    return tools.map((tool) => {
      const owner = ownerMap.get(tool.ownerId);
      return {
        _id: tool._id,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        status: tool.status,
        ownerId: tool.ownerId,
        ownerName: owner?.name ?? "Neighbor",
        ownerIsTrustedLender: owner?.isTrustedLender ?? false,
        isOwner: tool.ownerId === currentUser._id,
        createdAt: tool.createdAt,
      };
    });
  },
});

/**
 * AUTHENTICATED query: List only tools owned by the signed-in user.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * AUTHENTICATED mutation: Create a new tool listing owned by the caller.
 */
export const create = mutation({
  args: {
    name: v.string(),
    category: toolCategoryValidator,
    condition: toolConditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const name = args.name.trim();
    const description = args.description.trim();

    if (name.length < 2 || name.length > 80) {
      throw new Error("Tool name must be between 2 and 80 characters.");
    }
    if (description.length < 5 || description.length > 500) {
      throw new Error("Description must be between 5 and 500 characters.");
    }

    const now = Date.now();
    return await ctx.db.insert("tools", {
      name,
      category: args.category,
      condition: args.condition,
      description,
      ownerId: user._id,
      status: "available",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * OWNER-ONLY mutation: Update a tool listing.
 */
export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.string(),
    category: toolCategoryValidator,
    condition: toolConditionValidator,
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new Error("Tool not found.");
    }

    assertOwner(user, tool.ownerId, "tool listing");

    const name = args.name.trim();
    const description = args.description.trim();

    if (name.length < 2 || name.length > 80) {
      throw new Error("Tool name must be between 2 and 80 characters.");
    }
    if (description.length < 5 || description.length > 500) {
      throw new Error("Description must be between 5 and 500 characters.");
    }

    await ctx.db.patch(tool._id, {
      name,
      category: args.category,
      condition: args.condition,
      description,
      updatedAt: Date.now(),
    });

    return { updated: true };
  },
});

/**
 * OWNER OR ADMIN mutation: Remove a tool listing.
 * Regular users cannot delete a tool while it is actively borrowed;
 * admins can force-remove any listing (and any pending requests are declined).
 */
export const remove = mutation({
  args: {
    toolId: v.id("tools"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new Error("Tool not found.");
    }

    assertOwnerOrAdmin(user, tool.ownerId, "tool listing");

    if (tool.status === "borrowed" && user.role !== "admin") {
      throw new Error(
        "Cannot delete a tool while it is currently borrowed. Mark it returned first."
      );
    }

    // Decline any open pending loan requests for this tool before deleting
    const relatedLoans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect();

    const now = Date.now();
    for (const loan of relatedLoans) {
      if (loan.status === "pending") {
        await ctx.db.patch(loan._id, {
          status: "declined",
          updatedAt: now,
        });
      }
    }

    await ctx.db.delete(tool._id);
    return { deleted: true };
  },
});
