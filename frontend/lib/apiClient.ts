import { authHeaders } from "@/lib/demoToken";
import { publicApiUrl } from "@/lib/publicApiUrl";
import { adminHeaders } from "@/components/AdminTokenField";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = RequestInit & { json?: unknown };

/**
 * Browser-side API helper (uses Next.js /api proxy).
 * Attaches demo token headers on mutating requests when present.
 */
export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...adminHeaders(),
      ...headers,
    },
    cache: "no-store",
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  };

  const res = await fetch(publicApiUrl(path), init);
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed (${res.status})`;
    throw new ApiError(detail, res.status, body);
  }

  return body as T;
}
