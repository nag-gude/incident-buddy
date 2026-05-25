export default function IncidentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-32 rounded bg-slate-800" />
      <div className="h-10 rounded-xl bg-slate-800" />
      <div className="h-24 rounded-2xl bg-slate-800/80" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-xl bg-slate-800/60" />
        <div className="h-64 rounded-xl bg-slate-800/60" />
      </div>
    </div>
  );
}
