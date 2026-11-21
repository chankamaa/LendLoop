"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Award, Shield, Trash2, Users, Wrench, ClipboardList } from "lucide-react";
import { LoanCard } from "@/components/LoanCard";
import { getErrorMessage } from "@/lib/constants";

interface AdminPanelProps {
  onNotify: (msg: string, type?: "success" | "error") => void;
}

export function AdminPanel({ onNotify }: AdminPanelProps) {
  const users = useQuery(api.users.listAllUsers);
  const allLoans = useQuery(api.loans.listAllLoans);
  const allTools = useQuery(api.tools.listAll, {});

  const toggleTrusted = useMutation(api.users.toggleTrustedLender);
  const removeTool = useMutation(api.tools.remove);

  const [section, setSection] = useState<"users" | "loans" | "tools">("users");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggleTrusted(userId: Id<"users">) {
    setBusyId(userId);
    try {
      const res = await toggleTrusted({ userId });
      onNotify(
        res.isTrustedLender
          ? "Granted Trusted Lender badge."
          : "Removed Trusted Lender badge."
      );
    } catch (err) {
      onNotify(getErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveTool(toolId: Id<"tools">, toolName: string) {
    if (!confirm(`Remove listing "${toolName}" as Admin?`)) return;
    setBusyId(toolId);
    try {
      await removeTool({ toolId });
      onNotify(`Removed "${toolName}".`);
    } catch (err) {
      onNotify(getErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Admin Moderation Panel
            </h2>
            <p className="text-xs text-slate-500">
              Manage Trusted Lender badges, inspect all platform loans, and
              moderate listings.
            </p>
          </div>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium">
          <button
            onClick={() => setSection("users")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              section === "users"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Users ({users?.length ?? "…"})
          </button>
          <button
            onClick={() => setSection("loans")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              section === "loans"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            All Loans ({allLoans?.length ?? "…"})
          </button>
          <button
            onClick={() => setSection("tools")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              section === "tools"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            All Listings ({allTools?.length ?? "…"})
          </button>
        </div>
      </div>

      {/* Users & Trusted Lender Toggles */}
      {section === "users" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Trust Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users === undefined ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {u.isTrustedLender ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            <Award className="h-3.5 w-3.5" />
                            Trusted Lender
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Standard</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          disabled={busyId === u._id}
                          onClick={() => handleToggleTrusted(u._id)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            u.isTrustedLender
                              ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {u.isTrustedLender
                            ? "Revoke Trusted"
                            : "Mark Trusted"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Platform Loans */}
      {section === "loans" && (
        <div className="space-y-3">
          {allLoans === undefined ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading platform loans...
            </div>
          ) : allLoans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No loans have been created yet.
            </div>
          ) : (
            allLoans.map((loan) => (
              <LoanCard key={loan._id} loan={loan} perspective="admin" />
            ))
          )}
        </div>
      )}

      {/* All Listings Moderation */}
      {section === "tools" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {allTools === undefined ? (
            <div className="col-span-full rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Loading listings...
            </div>
          ) : allTools.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No tool listings yet.
            </div>
          ) : (
            allTools.map((tool) => (
              <div
                key={tool._id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {tool.category}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tool.status === "available"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {tool.status === "available" ? "Available" : "Borrowed"}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold text-slate-900">
                    {tool.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Owner: {tool.ownerName} · Condition: {tool.condition}
                  </p>
                </div>

                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                  <button
                    disabled={busyId === tool._id}
                    onClick={() => handleRemoveTool(tool._id, tool.name)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Listing
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
