/**
 * Server-side API helpers for React Server Components.
 * Client components should use `apiFetch` from `apiClient.ts` (relative /api proxy).
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiBase(): Promise<string> {
  // Browser code should use apiClient; this module is SSR-only in practice.
  if (typeof window !== "undefined") return "";

  // Docker / production: call the API service directly (e.g. http://api:8080).
  const backend = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (backend) return backend;

  // Local dev without Docker: hit the FastAPI process on the host.
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = await apiBase();
  const r = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!r.ok) throw new ApiError(await r.text(), r.status);
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const base = await apiBase();
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new ApiError(await r.text(), r.status);
  return r.json() as Promise<T>;
}
