import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTranscriber } from "@/lib/pipeline";

// Transcription can take a while on hard cards; allow up to 5 minutes.
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const { recipeId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, uploaded_by, status")
    .eq("id", recipeId)
    .single();
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }
  if (recipe.uploaded_by !== user.id) {
    return NextResponse.json(
      { error: "Only the uploader can process a recipe" },
      { status: 403 }
    );
  }

  const { data: image } = await supabase
    .from("recipe_images")
    .select("storage_path")
    .eq("recipe_id", recipeId)
    .eq("kind", "original")
    .order("position")
    .limit(1)
    .single();
  if (!image) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("recipe-images")
    .download(image.storage_path);
  if (downloadError || !blob) {
    return NextResponse.json(
      { error: `Could not read image: ${downloadError?.message}` },
      { status: 500 }
    );
  }

  try {
    const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    const mediaType = (blob.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp";

    const transcriber = getTranscriber();
    const { result, meta } = await transcriber.transcribe({
      imageBase64,
      mediaType,
    });

    const { error: updateError } = await supabase
      .from("recipes")
      .update({
        status: "draft",
        title: result.title,
        attribution: result.attribution || null,
        category: result.category,
        tags: result.tags,
        body_md: result.bodyMarkdown,
        transcription_notes:
          [
            result.isRecipe ? null : "Flagged as a non-recipe page.",
            result.notes || null,
          ]
            .filter(Boolean)
            .join(" ") || null,
        pipeline_meta: meta,
      })
      .eq("id", recipeId);
    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ status: "draft" });
  } catch (err) {
    await supabase
      .from("recipes")
      .update({
        status: "failed",
        transcription_notes: err instanceof Error ? err.message : String(err),
      })
      .eq("id", recipeId);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
