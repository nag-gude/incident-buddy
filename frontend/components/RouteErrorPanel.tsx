"use client";

export function RouteErrorPanel({
  title,
  message,
  reset,
}: {
  title: string;
  message?: string;
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6">
      <h1 className="text-lg font-semibold text-red-100">{title}</h1>
      {message && <p className="mt-2 text-sm text-red-200/90">{message}</p>}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-alert px-4 py-2 text-sm font-semibold text-ink-950"
      >
        Retry
      </button>
    </div>
  );
}
