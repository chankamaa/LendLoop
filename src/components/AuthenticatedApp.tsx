"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  Award,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  TOOL_CATEGORIES,
  ToolCategory,
  ToolCondition,
  getErrorMessage,
} from "@/lib/constants";
import { ToolFormModal } from "@/components/ToolFormModal";
import { BorrowModal } from "@/components/BorrowModal";
import { LoanCard } from "@/components/LoanCard";
import { AdminPanel } from "@/components/AdminPanel";

type ActiveTab =
  | "all"
  | "my-listings"
  | "my-requests"
  | "incoming"
  | "admin";

export function AuthenticatedApp() {
  const syncUser = useMutation(api.users.syncUser);
  const currentUser = useQuery(api.users.currentUser);
  const [syncReady, setSyncReady] = useState(false);

  useEffect(() => {
    let active = true;
    syncUser()
      .then(() => {
        if (active) setSyncReady(true);
      })
      .catch((err) => {
        console.error("Failed to sync user:", err);
      });
    return () => {
      active = false;
    };
  }, [syncUser]);

  if (!syncReady || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Loading your LendLoop workspace...
        </div>
      </div>
    );
  }

  return <DashboardContent currentUser={currentUser} />;
}

interface DashboardContentProps {
  currentUser: {
    _id: Id<"users">;
    name: string;
    email: string;
    role: "admin" | "user";
    isTrustedLender: boolean;
  };
}

function DashboardContent({ currentUser }: DashboardContentProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [selectedCategory, setSelectedCategory] = useState<
    ToolCategory | "All"
  >("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTool, setEditingTool] = useState<{
    toolId: Id<"tools">;
    name: string;
    category: ToolCategory;
    condition: ToolCondition;
    description: string;
  } | null>(null);
  const [borrowingTool, setBorrowingTool] = useState<{
    _id: Id<"tools">;
    name: string;
    ownerName: string;
  } | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  function notify(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }

  // Queries
  const allTools = useQuery(api.tools.listAll, {
    category: selectedCategory === "All" ? undefined : selectedCategory,
  });
  const myListings = useQuery(api.tools.listMine);
  const myRequests = useQuery(api.loans.listMyRequests);
  const incomingRequests = useQuery(api.loans.listIncomingRequests);

  // Mutations
  const removeTool = useMutation(api.tools.remove);
  const approveRequest = useMutation(api.loans.approveRequest);
  const declineRequest = useMutation(api.loans.declineRequest);
  const markReturned = useMutation(api.loans.markReturned);

  const [busyLoanId, setBusyLoanId] = useState<Id<"loans"> | null>(null);
  const [busyToolId, setBusyToolId] = useState<Id<"tools"> | null>(null);

  const pendingIncomingCount =
    incomingRequests?.filter((l) => l.status === "pending").length ?? 0;

  const filteredTools = (allTools ?? []).filter((tool) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.ownerName.toLowerCase().includes(q)
    );
  });

  async function handleDeleteTool(toolId: Id<"tools">, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setBusyToolId(toolId);
    try {
      await removeTool({ toolId });
      notify(`Deleted "${name}".`);
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setBusyToolId(null);
    }
  }

  async function handleLoanAction(
    loanId: Id<"loans">,
    action: "approve" | "decline" | "return"
  ) {
    setBusyLoanId(loanId);
    try {
      if (action === "approve") {
        await approveRequest({ loanId });
        notify("Request approved — tool is now marked as Borrowed.");
      } else if (action === "decline") {
        await declineRequest({ loanId });
        notify("Request declined — tool remains Available.");
      } else {
        await markReturned({ loanId });
        notify("Loan marked as returned — tool is Available again!");
      }
    } catch (err) {
      notify(getErrorMessage(err), "error");
    } finally {
      setBusyLoanId(null);
    }
  }

  const tabs: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: "all", label: "All Tools" },
    { id: "my-listings", label: "My Listings", badge: myListings?.length },
    { id: "my-requests", label: "My Requests" },
    {
      id: "incoming",
      label: "Incoming Requests",
      badge: pendingIncomingCount > 0 ? pendingIncomingCount : undefined,
    },
    ...(currentUser.role === "admin"
      ? [{ id: "admin" as const, label: "Admin Panel" }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  LendLoop
                </span>
                {currentUser.role === "admin" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                    <Shield className="h-3 w-3" />
                    Admin
                  </span>
                )}
                {currentUser.isTrustedLender && (
                  <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
                    <Award className="h-3 w-3" />
                    Trusted Lender
                  </span>
                )}
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                Borrow what you need. Lend what you don&apos;t.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">List a Tool</span>
              <span className="sm:hidden">List</span>
            </button>
            <UserButton />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
          <nav className="flex gap-1 border-t border-slate-100 pt-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                          tab.id === "incoming"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-slate-900 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* TAB 1: ALL TOOLS */}
        {activeTab === "all" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(["All", ...TOOL_CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedCategory === cat
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tools..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {allTools === undefined ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
                  />
                ))}
              </div>
            ) : filteredTools.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No tools match your current filter.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  List the first tool
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTools.map((tool) => (
                  <div
                    key={tool._id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {tool.category}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            tool.status === "available"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              tool.status === "available"
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            }`}
                          />
                          {tool.status === "available"
                            ? "Available"
                            : "Borrowed"}
                        </span>
                      </div>

                      <h3 className="mt-3 text-base font-semibold text-slate-900">
                        {tool.name}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Condition: {tool.condition}
                      </p>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-5 space-y-3 border-t border-slate-100 pt-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <span>
                          Owner:{" "}
                          <strong className="text-slate-900">
                            {tool.isOwner ? "You" : tool.ownerName}
                          </strong>
                        </span>
                        {tool.ownerIsTrustedLender && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            <Award className="h-3 w-3" />
                            Trusted Lender
                          </span>
                        )}
                      </div>

                      {!tool.isOwner && tool.status === "available" && (
                        <button
                          onClick={() =>
                            setBorrowingTool({
                              _id: tool._id,
                              name: tool.name,
                              ownerName: tool.ownerName,
                            })
                          }
                          className="w-full rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Request to Borrow
                        </button>
                      )}
                      {!tool.isOwner && tool.status === "borrowed" && (
                        <div className="w-full rounded-xl bg-slate-100 px-3.5 py-2 text-center text-xs font-medium text-slate-500">
                          Currently Borrowed
                        </div>
                      )}
                      {tool.isOwner && (
                        <div className="w-full rounded-xl bg-slate-50 px-3.5 py-2 text-center text-xs font-medium text-slate-500">
                          Your Listing
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY LISTINGS */}
        {activeTab === "my-listings" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                My Tool Listings
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Tool
              </button>
            </div>

            {myListings === undefined ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading your listings...
              </div>
            ) : myListings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="text-sm font-medium text-slate-700">
                  You haven&apos;t listed any tools yet.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Share a drill, ladder, or camping gear sitting idle in your
                  garage.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myListings.map((tool) => (
                  <div
                    key={tool._id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
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
                          {tool.status === "available"
                            ? "Available"
                            : "Borrowed"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-slate-900">
                        {tool.name}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Condition: {tool.condition}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3.5">
                      <button
                        onClick={() =>
                          setEditingTool({
                            toolId: tool._id,
                            name: tool.name,
                            category: tool.category,
                            condition: tool.condition,
                            description: tool.description,
                          })
                        }
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        disabled={busyToolId === tool._id}
                        onClick={() => handleDeleteTool(tool._id, tool.name)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY REQUESTS */}
        {activeTab === "my-requests" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              My Borrow Requests
            </h2>
            {myRequests === undefined ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading your requests...
              </div>
            ) : myRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
                You haven&apos;t requested any tools yet. Browse &ldquo;All
                Tools&rdquo; to borrow something!
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.map((loan) => (
                  <LoanCard
                    key={loan._id}
                    loan={loan}
                    perspective="borrower"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: INCOMING REQUESTS */}
        {activeTab === "incoming" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Incoming Borrow Requests
            </h2>
            {incomingRequests === undefined ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading incoming requests...
              </div>
            ) : incomingRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
                No one has requested your tools yet.
              </div>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((loan) => (
                  <LoanCard
                    key={loan._id}
                    loan={loan}
                    perspective="owner"
                    busyLoanId={busyLoanId}
                    onApprove={(id) => handleLoanAction(id, "approve")}
                    onDecline={(id) => handleLoanAction(id, "decline")}
                    onMarkReturned={(id) => handleLoanAction(id, "return")}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ADMIN PANEL */}
        {activeTab === "admin" && currentUser.role === "admin" && (
          <AdminPanel onNotify={notify} />
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <ToolFormModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSuccess={(msg) => notify(msg)}
        />
      )}

      {editingTool && (
        <ToolFormModal
          mode="edit"
          initialValues={editingTool}
          onClose={() => setEditingTool(null)}
          onSuccess={(msg) => notify(msg)}
        />
      )}

      {borrowingTool && (
        <BorrowModal
          tool={borrowingTool}
          onClose={() => setBorrowingTool(null)}
          onSuccess={(msg) => notify(msg)}
        />
      )}
    </div>
  );
}
