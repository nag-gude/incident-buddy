/** Runtime API base URL (Cloud Run backend). Empty → same-origin /api proxy. */
let runtimeApiUrl = "";

export function setPublicApiUrl(url: string) {
  runtimeApiUrl = (url || "").replace(/\/$/, "");
}

export function getPublicApiUrl(): string {
  return runtimeApiUrl;
}

export function publicApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (runtimeApiUrl) return `${runtimeApiUrl}${normalized}`;
  return normalized;
}
