"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { ChevronDown, X } from "lucide-react";
import {
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  ToolCategory,
  ToolCondition,
  getErrorMessage,
} from "@/lib/constants";

interface ToolFormModalProps {
  mode: "create" | "edit";
  initialValues?: {
    toolId: Id<"tools">;
    name: string;
    category: ToolCategory;
    condition: ToolCondition;
    description: string;
  };
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ToolFormModal({
  mode,
  initialValues,
  onClose,
  onSuccess,
}: ToolFormModalProps) {
  const createTool = useMutation(api.tools.create);
  const updateTool = useMutation(api.tools.update);

  const [name, setName] = useState(initialValues?.name ?? "");
  const [category, setCategory] = useState<ToolCategory>(
    initialValues?.category ?? "Power Tools"
  );
  const [condition, setCondition] = useState<ToolCondition>(
    initialValues?.condition ?? "Good"
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "create") {
        await createTool({ name, category, condition, description });
        onSuccess("Tool listed successfully!");
      } else if (initialValues) {
        await updateTool({
          toolId: initialValues.toolId,
          name,
          category,
          condition,
          description,
        });
        onSuccess("Tool listing updated.");
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === "create" ? "List a New Tool" : "Edit Tool Listing"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Tool Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., DeWalt 20V Cordless Drill"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <div className="relative mt-1">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ToolCategory)}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-3.5 pr-10 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {TOOL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Condition
              </label>
              <div className="relative mt-1">
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as ToolCondition)}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-3.5 pr-10 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {TOOL_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              required
              minLength={5}
              maxLength={500}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include accessories, battery/charger info, or pickup notes..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : mode === "create"
                  ? "Publish Tool"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
