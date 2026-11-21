"use client";

import { useUser } from "@clerk/nextjs";
import { PublicBoard } from "@/components/PublicBoard";
import { AuthenticatedApp } from "@/components/AuthenticatedApp";

export default function HomePage() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
          Loading LendLoop...
        </div>
      </div>
    );
  }

  return isSignedIn ? <AuthenticatedApp /> : <PublicBoard />;
}
