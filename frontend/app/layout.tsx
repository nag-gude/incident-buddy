import type { Metadata } from "next";
import { DemoTokenBootstrap } from "@/components/DemoTokenBootstrap";
import { LiveSession } from "@/components/LiveSession";
import "./globals.css";

export const metadata: Metadata = {
  title: "IncidentBuddy",
  description: "Resilient on-call incident copilot — DevNetwork / TrueFoundry hackathon",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <DemoTokenBootstrap />
        <header className="border-b border-slate-800 bg-ink-900/80 backdrop-blur">
          <NavBar />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

function NavBar() {
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <a href="/" className="font-semibold tracking-tight text-alert">
        IncidentBuddy
      </a>
      <nav className="flex items-center gap-6 text-sm text-slate-400">
        <a href="/" className="hover:text-white">
          Home
        </a>
        <a href="/incidents" className="hover:text-white">
          Incidents
        </a>
        <a href="/admin" className="hover:text-white">
          Admin
        </a>
        <a href="/admin/chaos" className="hover:text-white">
          Chaos
        </a>
        <LiveSession />
      </nav>
    </div>
  );
}
