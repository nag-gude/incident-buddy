export type StreamConnectionStatus = "connecting" | "live" | "reconnecting";

export function streamStatusLabel(
  status: StreamConnectionStatus,
  variant: "short" | "detail" = "short",
): string {
  if (status === "live") return variant === "detail" ? "Live stream on" : "Live";
  if (status === "reconnecting") {
    return variant === "detail"
      ? "Reconnecting stream… (API may be busy — wait or pause loop on Admin)"
      : "Reconnecting…";
  }
  return variant === "detail"
    ? "Connecting stream… (if this persists, API may be rate-limited)"
    : "Connecting…";
}
