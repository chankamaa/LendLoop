"use client";

import { Id } from "@convex/_generated/dataModel";
import {
  AlertTriangle,
  Award,
  Bell,
  Calendar,
  Check,
  RotateCcw,
  X,
} from "lucide-react";
import { formatRelativeTime, isLoanOverdue } from "@/lib/constants";

export interface LoanCardData {
  _id: Id<"loans">;
  toolName: string;
  toolCategory: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "declined" | "returned";
  note?: string;
  ownerName?: string;
  ownerIsTrustedLender?: boolean;
  borrowerName?: string;
  overdueReminderSentAt?: number;
  lastAutomationEvent?: {
    type: string;
    message: string;
    timestamp: number;
  };
}

interface LoanCardProps {
  loan: LoanCardData;
  perspective: "borrower" | "owner" | "admin";
  busyLoanId?: Id<"loans"> | null;
  onApprove?: (loanId: Id<"loans">) => void;
  onDecline?: (loanId: Id<"loans">) => void;
  onMarkReturned?: (loanId: Id<"loans">) => void;
}

const STATUS_STYLES: Record<LoanCardData["status"], string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  declined: "bg-slate-100 text-slate-600 border-slate-200",
  returned: "bg-sky-50 text-sky-800 border-sky-200",
};

const STATUS_LABELS: Record<LoanCardData["status"], string> = {
  pending: "Pending Approval",
  approved: "Active Loan",
  declined: "Declined",
  returned: "Returned",
};

export function LoanCard({
  loan,
  perspective,
  busyLoanId,
  onApprove,
  onDecline,
  onMarkReturned,
}: LoanCardProps) {
  const overdue = isLoanOverdue(loan.status, loan.endDate);
  const isBusy = busyLoanId === loan._id;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {loan.toolCategory}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[loan.status]}`}
            >
              {STATUS_LABELS[loan.status]}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-900">
            {loan.toolName}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {loan.startDate} → {loan.endDate}
          </span>
        </div>
      </div>

      {/* Counterparty details */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        {perspective === "borrower" && loan.ownerName && (
          <span className="inline-flex items-center gap-1.5">
            Owner: <strong className="text-slate-900">{loan.ownerName}</strong>
            {loan.ownerIsTrustedLender && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <Award className="h-3 w-3" />
                Trusted Lender
              </span>
            )}
          </span>
        )}
        {perspective === "owner" && loan.borrowerName && (
          <span>
            Requested by:{" "}
            <strong className="text-slate-900">{loan.borrowerName}</strong>
          </span>
        )}
        {perspective === "admin" && (
          <>
            <span>
              Owner:{" "}
              <strong className="text-slate-900">{loan.ownerName}</strong>
            </span>
            <span>
              Borrower:{" "}
              <strong className="text-slate-900">{loan.borrowerName}</strong>
            </span>
          </>
        )}
      </div>

      {loan.note && (
        <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 italic">
          &ldquo;{loan.note}&rdquo;
        </p>
      )}

      {/* Bonus Feature: Recent Automation Activity */}
      {loan.lastAutomationEvent && (
        <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-800">
          <Bell className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
          <span>
            {loan.lastAutomationEvent.message}{" "}
            <span className="font-medium text-indigo-600">
              {formatRelativeTime(loan.lastAutomationEvent.timestamp)}
            </span>
          </span>
        </div>
      )}

      {/* Owner Actions */}
      {perspective === "owner" && loan.status === "pending" && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
          <button
            disabled={isBusy}
            onClick={() => onApprove?.(loan._id)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </button>
          <button
            disabled={isBusy}
            onClick={() => onDecline?.(loan._id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
        </div>
      )}

      {perspective === "owner" && loan.status === "approved" && (
        <div className="mt-4 flex items-center border-t border-slate-100 pt-3.5">
          <button
            disabled={isBusy}
            onClick={() => onMarkReturned?.(loan._id)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Mark as Returned
          </button>
        </div>
      )}
    </div>
  );
}
