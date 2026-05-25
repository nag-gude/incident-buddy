export function DegradedBanner({ flags }: { flags: string[] }) {
  if (!flags.length) return null;
  return (
    <div
      role="alert"
      className="w-full rounded-lg border border-amber-600/60 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
    >
      <span className="font-semibold">Degraded: </span>
      {flags.join(" · ")}
    </div>
  );
}
