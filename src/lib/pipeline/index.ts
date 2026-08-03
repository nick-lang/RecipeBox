import { createClaudeTranscriber } from "./claude";
import type { Transcriber } from "./types";

export type { Transcriber, TranscriptionInput, TranscriptionResult } from "./types";

/**
 * Returns the active transcriber. Selection is env-driven so pipeline
 * experiments can swap implementations/models without code changes:
 *   TRANSCRIBER=claude (default)   TRANSCRIBER_MODEL=claude-opus-5 | ...
 */
export function getTranscriber(): Transcriber {
  const kind = process.env.TRANSCRIBER ?? "claude";
  switch (kind) {
    case "claude":
      return createClaudeTranscriber();
    default:
      throw new Error(`Unknown TRANSCRIBER: ${kind}`);
  }
}
