import type { Category } from "@/lib/categories";

// The pipeline is deliberately kept behind this interface so different
// transcribers (models, prompt versions, preprocessing variants) can be
// swapped and compared in cost/reliability experiments.

export interface TranscriptionInput {
  /** Base64-encoded image data (no data: prefix). */
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface TranscriptionResult {
  /** False for box covers, dividers, blank pages, clippings that aren't recipes. */
  isRecipe: boolean;
  title: string;
  attribution: string;
  category: Category;
  /** Freeform descriptors from the card itself ("dessert", "canning", ...). */
  tags: string[];
  /** Full transcription as markdown, following the fidelity-first conventions. */
  bodyMarkdown: string;
  /** Uncertainties, margin notes context, second-recipe-on-card flags, etc. */
  notes: string;
}

export interface TranscriberMeta {
  /** Identifies the transcriber implementation, e.g. "claude". */
  transcriber: string;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
}

export interface Transcriber {
  id: string;
  transcribe(
    input: TranscriptionInput
  ): Promise<{ result: TranscriptionResult; meta: TranscriberMeta }>;
}
