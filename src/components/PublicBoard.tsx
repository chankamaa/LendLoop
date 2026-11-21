"use client";

import { SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Lock, ShieldCheck, Wrench } from "lucide-react";

export function PublicBoard() {
  const publicTools = useQuery(api.tools.listPublic);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                LendLoop
              </span>
              <p className="hidden text-xs text-slate-500 sm:block">
                Borrow what you need. Lend what you don&apos;t.
              </p>
            </div>
          </div>

          <SignInButton mode="modal">
            <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              Sign in to lend or borrow
            </button>
          </SignInButton>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-8 pt-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Neighborhood Tool-Lending Board
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Borrow what you need. Lend what you don&apos;t.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Browse tools currently available in your neighborhood. Sign in to
            see tool details, request a borrow window, or list tools from your
            own garage.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SignInButton mode="modal">
              <button className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                Sign in to lend or borrow
              </button>
            </SignInButton>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              Neighbor identities &amp; details are hidden until you sign in.
            </div>
          </div>
        </div>
      </section>

      {/* Public Available Tools List (Name & Category ONLY) */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Currently Available Nearby
          </h2>
          {publicTools !== undefined && (
            <span className="text-xs font-medium text-slate-500">
              {publicTools.length} tool{publicTools.length === 1 ? "" : "s"}{" "}
              available
            </span>
          )}
        </div>

        {publicTools === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
              />
            ))}
          </div>
        ) : publicTools.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No tools are currently listed as available.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sign in to be the first neighbor to list a tool!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicTools.map((tool) => (
              <div
                key={tool._id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {tool.category}
                  </span>
                  <h3 className="mt-2.5 text-base font-semibold text-slate-900">
                    {tool.name}
                  </h3>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Available
                  </span>
                  <SignInButton mode="modal">
                    <button className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                      Sign in to borrow →
                    </button>
                  </SignInButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
