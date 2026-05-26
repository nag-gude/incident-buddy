import type { TranscriptEvent } from "@/lib/types";

/** Keep only transcript from the latest agent run (each run starts with `triage`). */
export function transcriptForLatestRun(transcript: TranscriptEvent[]): TranscriptEvent[] {
  let start = 0;
  for (let i = 0; i < transcript.length; i += 1) {
    if (transcript[i].step === "triage") start = i;
  }
  return transcript.slice(start);
}
