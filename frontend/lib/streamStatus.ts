export type StreamConnectionStatus = "connecting" | "live" | "reconnecting";

export function streamStatusLabel(
  status: StreamConnectionStatus,
  variant: "short" | "detail" = "short",
): string {
  if (status === "live") return variant === "detail" ? "Live stream on" : "Live";
  if (status === "reconnecting") {
    return variant === "detail" ? "Reconnecting stream…" : "Reconnecting…";
  }
  return variant === "detail" ? "Connecting stream…" : "Connecting…";
}
