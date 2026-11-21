export const TOOL_CATEGORIES = [
  "Power Tools",
  "Garden",
  "Kitchen",
  "Camping",
  "Electronics",
  "Other",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_CONDITIONS = ["Like New", "Good", "Fair"] as const;

export type ToolCondition = (typeof TOOL_CONDITIONS)[number];

export function formatRelativeTime(timestamp: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isLoanOverdue(status: string, endDate: string): boolean {
  if (status !== "approved") return false;
  return endDate < getTodayIso();
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Convex wraps server errors with a prefix; keep the user-facing message clean
    const cleaned = err.message
      .replace(/^\[CONVEX[^\]]*\]\s*/i, "")
      .replace(/^Uncaught Error:\s*/i, "")
      .split("\n")[0];
    return cleaned || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
