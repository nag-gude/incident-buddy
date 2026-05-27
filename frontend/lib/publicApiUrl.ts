/** Browser API paths — always same-origin `/api/*` (Next.js rewrites to BACKEND_URL). */
export function publicApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized;
}
