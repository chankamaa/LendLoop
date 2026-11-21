import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;

/**
 * Returns the authenticated Convex user record, or null if unauthenticated
 * or not yet synced. Never trusts client-supplied user IDs or roles.
 */
export async function getCurrentUser(
  ctx: AuthCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/**
 * Enforces authentication on queries and mutations.
 * Throws if the caller has no valid Clerk JWT or no synced user record.
 */
export async function requireUser(ctx: AuthCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) {
    throw new Error(
      "Unauthorized: User profile not initialized. Please refresh the page."
    );
  }

  return user;
}

/**
 * Enforces admin role strictly on the backend.
 */
export async function requireAdmin(ctx: AuthCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin privileges required.");
  }
  return user;
}

/**
 * Enforces resource ownership (exact owner match).
 */
export function assertOwner(
  user: Doc<"users">,
  ownerId: Id<"users">,
  resourceName = "resource"
): void {
  if (user._id !== ownerId) {
    throw new Error(`Forbidden: You do not own this ${resourceName}.`);
  }
}

/**
 * Enforces resource ownership OR admin privilege.
 */
export function assertOwnerOrAdmin(
  user: Doc<"users">,
  ownerId: Id<"users">,
  resourceName = "resource"
): void {
  if (user._id !== ownerId && user.role !== "admin") {
    throw new Error(
      `Forbidden: Only the owner or an admin can perform this action on this ${resourceName}.`
    );
  }
}
