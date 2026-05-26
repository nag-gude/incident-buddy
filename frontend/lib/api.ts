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

const SSR_FETCH_TIMEOUT_MS = 25_000;

async function apiBase(): Promise<string> {
  // Browser code should use apiClient; this module is SSR-only in practice.
  if (typeof window !== "undefined") return "";

  // Route SSR through this Next.js instance so /api rewrites (build-time BACKEND_URL)
  // match browser traffic. Direct BACKEND_URL fetch fails on Cloud Run when runtime
  // env is missing and falls back to localhost:8000 inside the UI container.
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Request failed (${res.status})`;
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* plain text */
  }
  return text;
}

async function ssrFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = await apiBase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SSR_FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${base}${path}`, { cache: "no-store", signal: controller.signal, ...init });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("API request timed out — backend may be cold-starting", 504);
    }
    const message =
      err instanceof Error ? err.message : "API unreachable from UI server";
    throw new ApiError(message, 503);
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await ssrFetch(path);
  if (!r.ok) throw new ApiError(await parseApiError(r), r.status);
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const r = await ssrFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new ApiError(await parseApiError(r), r.status);
  return r.json() as Promise<T>;
}
