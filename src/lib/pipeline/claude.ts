import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CATEGORIES } from "@/lib/categories";
import { PROMPT_VERSION, TRANSCRIPTION_PROMPT } from "./prompt";
import type { Transcriber, TranscriptionInput } from "./types";

const TranscriptionSchema = z.object({
  is_recipe: z.boolean(),
  title: z.string(),
  attribution: z.string(),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()),
  body_markdown: z.string(),
  transcription_notes: z.string(),
});

export function createClaudeTranscriber(options?: {
  model?: string;
}): Transcriber {
  const model =
    options?.model ?? process.env.TRANSCRIBER_MODEL ?? "claude-opus-5";

  return {
    id: `claude:${model}:${PROMPT_VERSION}`,

    async transcribe(input: TranscriptionInput) {
      const client = new Anthropic();
      const started = Date.now();

      const response = await client.messages.parse({
        model,
        max_tokens: 8192,
        system: TRANSCRIPTION_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mediaType,
                  data: input.imageBase64,
                },
              },
              { type: "text", text: "Transcribe this recipe photo." },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(TranscriptionSchema) },
      });

      if (response.stop_reason === "refusal" || !response.parsed_output) {
        throw new Error(
          `Transcription failed (stop_reason: ${response.stop_reason})`
        );
      }

      const parsed = response.parsed_output;
      return {
        result: {
          isRecipe: parsed.is_recipe,
          title: parsed.title,
          attribution: parsed.attribution,
          category: parsed.category,
          tags: parsed.tags,
          bodyMarkdown: parsed.body_markdown,
          notes: parsed.transcription_notes,
        },
        meta: {
          transcriber: "claude",
          model,
          promptVersion: PROMPT_VERSION,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          durationMs: Date.now() - started,
        },
      };
    },
  };
}
