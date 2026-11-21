import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, requireAdmin } from "./lib/auth";

/**
 * Syncs the authenticated Clerk identity into the Convex `users` table.
 * Always defaults new users to role="user" and isTrustedLender=false.
 * Clients cannot pass role or trust flags.
 */
export const syncUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Cannot sync unauthenticated user.");
    }

    const clerkId = identity.subject;
    const email = identity.email ?? "";
    const derivedName =
      identity.name ||
      [identity.givenName, identity.familyName].filter(Boolean).join(" ") ||
      (email ? email.split("@")[0] : "Neighbor");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      if (existing.name !== derivedName || existing.email !== email) {
        await ctx.db.patch(existing._id, {
          name: derivedName,
          email,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId,
      name: derivedName,
      email,
      role: "user",
      isTrustedLender: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Returns the currently signed-in user's profile (including role & trusted badge).
 * Returns null if signed out.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isTrustedLender: user.isTrustedLender,
      createdAt: user.createdAt,
    };
  },
});

/**
 * Admin-only: Lists all users for the Admin Panel.
 */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").order("desc").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      isTrustedLender: u.isTrustedLender,
      createdAt: u.createdAt,
    }));
  },
});

/**
 * Admin-only: Toggles the "Trusted Lender" badge on any user.
 */
export const toggleTrustedLender = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new Error("User not found.");
    }

    const nextValue = !target.isTrustedLender;
    await ctx.db.patch(target._id, {
      isTrustedLender: nextValue,
    });

    return { userId: target._id, isTrustedLender: nextValue };
  },
});

/**
 * Internal-only helper (CLI / Convex Dashboard only, never callable from client).
 * Promotes a user to admin by email so test accounts can be elevated safely
 * without exposing a public privilege-escalation mutation.
 *
 * Usage:
 *   npx convex run users:promoteToAdmin '{"email":"you@example.com"}'
 */
export const promoteToAdmin = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    const allUsers = await ctx.db.query("users").collect();
    const target = allUsers.find(
      (u) => u.email.trim().toLowerCase() === normalizedEmail
    );

    if (!target) {
      throw new Error(
        `No synced user found with email "${args.email}". Sign in once first.`
      );
    }

    await ctx.db.patch(target._id, { role: "admin" });
    return {
      promoted: true,
      userId: target._id,
      email: target.email,
      role: "admin",
    };
  },
});
