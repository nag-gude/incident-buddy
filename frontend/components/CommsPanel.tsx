"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/apiClient";

type Draft = {
  id: string;
  body: string;
  status: string;
};

export function CommsPanel({
  incidentId,
  draft,
  onUpdated,
}: {
  incidentId: string;
  draft: Draft | null;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("oncall@demo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!draft || draft.status !== "pending") {
    return (
      <p className="text-sm text-slate-500">
        {draft?.status === "approved" ? "Comms approved and posted (mock)." : "No pending draft."}
      </p>
    );
  }

  const pendingDraft = draft;

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/incidents/${incidentId}/approve-comms`, {
        method: "POST",
        json: { draft_id: pendingDraft.id, approver_name: name },
      });
      onUpdated?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/incidents/${incidentId}/reject-comms`, {
        method: "POST",
        json: { draft_id: pendingDraft.id, approver_name: name, reason: "Needs edit" },
      });
      onUpdated?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <pre className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/40 p-4 text-sm text-slate-300">
        {pendingDraft.body}
      </pre>
      <label htmlFor={`comms-approver-${incidentId}`} className="block text-xs text-slate-400">
        Approver name
      </label>
      <input
        id={`comms-approver-${incidentId}`}
        className="w-full rounded border border-slate-700 bg-ink-950 px-3 py-2 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="oncall@demo"
      />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={approve}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Approve & post
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={reject}
          className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
