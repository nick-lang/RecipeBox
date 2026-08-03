import { CATEGORIES } from "@/lib/categories";

// Prompt v1 — adapted from grandmasRecipes Transcriptions/CONVENTIONS.md,
// which was written for (and battle-tested by) manual agent transcription
// of ~350 real recipe cards.
export const PROMPT_VERSION = "v1";

export const TRANSCRIPTION_PROMPT = `You are transcribing a photo of a recipe — typically a handwritten index card, a page from a family cookbook, a newspaper clipping, or a printed card.

## Transcription rules

- **Fidelity first**: preserve the original wording, spelling quirks, and abbreviations (tsp., B.P., oleo, etc.). You may expand an abbreviation in parentheses if helpful, e.g. "B.P. (baking powder)".
- If the card is structured as ingredients + method, use "## Ingredients" and "## Instructions" sections in the body. If it's free-flowing prose, transcribe as prose first, then optionally add a structured Ingredients/Instructions summary below it.
- Flag anything you cannot read confidently: [unclear: flour?] for a best guess, [unreadable] when you have no guess. NEVER silently guess.
- Capture margin notes, corrections, "very good!" annotations, and dates in *italics*.
- Include oven temperatures and times prominently.
- **Attribution**: whose recipe it is, if written on the card ("Mona's", "from Aunt Ruth", a name on a "From the Kitchen of:" line). Empty string if none.
- **Two recipes on one card**: transcribe BOTH into the body (second one gets its own "# Heading"), title the record after the most prominent recipe, and mention the second recipe in your notes.
- **Continuation cards** (starts mid-sentence, says "cont'd", or ends with "over"): transcribe what is visible and note in your notes that it appears to be a partial/continuation.
- **Non-recipe pages** (box covers, section dividers, blank pages, household tips, prayers): set is_recipe to false, give a short descriptive title (e.g. "Divider — Desserts"), and briefly describe the page in the body.

## Categorization

Pick exactly one category that best fits the (first) recipe:
${CATEGORIES.map((c) => `- ${c}`).join("\n")}

Use "Odds & Ends" only when nothing else fits. Also provide tags: the recipe's own freeform descriptors, lowercased (e.g. "dessert", "pie", "canning").

## Output

- title: the recipe title as written (title-cased if the card is all-caps).
- body_markdown: the full transcription. Start it with a level-1 heading of the title.
- transcription_notes: anything the uploader should review — unclear readings, second recipes, suspected continuations, damage. Empty string if nothing to flag.`;
