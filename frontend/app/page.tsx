import { DemoToolbar } from "@/components/DemoToolbar";
import { LoopStatusStrip } from "@/components/LoopStatusStrip";
import { ResilienceMatrixCard } from "@/components/ResilienceMatrixCard";
import { ResilienceStatusStrip } from "@/components/ResilienceStatusStrip";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <ResilienceStatusStrip />
      <LoopStatusStrip />

      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-ink-900 to-ink-950 p-8">
        <p className="text-sm font-medium uppercase tracking-widest text-alert">DevNetwork AI + ML 2026</p>
        <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
          Your on-call partner that doesn&apos;t quit when the tools do.
        </h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          IncidentBuddy ingests alerts, gathers MCP evidence, proposes runbook steps, and drafts stakeholder
          comms — with graceful degradation when LLMs or observability tools fail. Built for the{" "}
          <strong className="text-slate-200">TrueFoundry Resilient Agents</strong> challenge.
        </p>
        <HomeLinks />
      </section>

      <ResilienceMatrixCard />

      <DemoToolbar />

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          title="Evidence-grounded"
          body="Metrics, deploys, and prior incidents persisted as bundles with live/cached badges."
        />
        <FeatureCard
          title="Human-in-the-loop"
          body="Approve Slack drafts before anything is posted — audit trail on the timeline."
        />
        <FeatureCard
          title="Chaos-ready"
          body="Toggle MCP/LLM failures from the Chaos panel and watch degraded mode keep engineers unblocked."
        />
      </section>
    </div>
  );
}

function HomeLinks() {
  return (
    <div className="mt-6 flex flex-wrap gap-4">
      <Link
        href="/incidents"
        className="rounded-lg bg-alert px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-alert-dim"
      >
        View incidents
      </Link>
      <Link
        href="/admin/chaos"
        className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
      >
        Chaos controls
      </Link>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-ink-900/60 p-5">
      <h2 className="font-semibold text-accent">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </div>
  );
}
