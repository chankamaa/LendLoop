import { query } from "./_generated/server";

export const health = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return {
      status: "ok",
      authenticated: identity !== null,
      subject: identity ? identity.subject : null,
    };
  },
});
