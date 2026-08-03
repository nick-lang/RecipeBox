import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { deleteRecipe, updateRecipe } from "@/app/actions";
import { CATEGORIES } from "@/lib/categories";
import type { Collection, Recipe, RecipeImage } from "@/lib/types";
import { RetryProcessingButton } from "./retry-button";

export default async function RecipePage(props: {
  params: Promise<{ recipeId: string }>;
}) {
  const { recipeId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: recipe } = (await supabase
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .single()) as { data: Recipe | null };
  if (!recipe) notFound();

  const [{ data: collection }, { data: images }] = await Promise.all([
    supabase
      .from("collections")
      .select("*")
      .eq("id", recipe.collection_id)
      .single() as unknown as Promise<{ data: Collection | null }>,
    supabase
      .from("recipe_images")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("position") as unknown as Promise<{ data: RecipeImage[] | null }>,
  ]);

  const imageUrls: string[] = [];
  if (images && images.length > 0) {
    const { data: signed } = await supabase.storage
      .from("recipe-images")
      .createSignedUrls(images.map((i) => i.storage_path), 3600);
    signed?.forEach((s) => s.signedUrl && imageUrls.push(s.signedUrl));
  }

  const isUploader = recipe.uploaded_by === user.id;
  const editing = isUploader && (recipe.status === "draft" || recipe.status === "failed");
  const backTo = collection
    ? `/groups/${collection.group_id}/collections/${collection.id}`
    : "/dashboard";

  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="text-sm">
        <Link href={backTo} className="text-amber-700 hover:underline">
          ← Back to {collection?.name ?? "collection"}
        </Link>
      </p>

      {recipe.status === "processing" && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="animate-pulse font-medium">
            ✍️ Still transcribing… refresh this page in a moment.
          </p>
        </div>
      )}

      {recipe.status === "failed" && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <p className="font-medium">⚠️ Transcription failed.</p>
          {recipe.transcription_notes && (
            <p className="mt-1 text-sm">{recipe.transcription_notes}</p>
          )}
          {isUploader && <RetryProcessingButton recipeId={recipe.id} />}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Original card image(s) */}
        <div className="flex flex-col gap-4">
          {imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`${recipe.title ?? "Recipe"} — original card`}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800"
            />
          ))}
          {imageUrls.length === 0 && (
            <div className="flex h-64 items-center justify-center rounded-lg bg-neutral-100 text-5xl dark:bg-neutral-900">
              🍲
            </div>
          )}
        </div>

        {/* Transcription: editable review form for the uploader's drafts,
            read-only render otherwise. */}
        {editing ? (
          <form action={updateRecipe} className="flex flex-col gap-3">
            <input type="hidden" name="recipe_id" value={recipe.id} />
            <div className="rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950">
              Review the transcription against the card, fix anything marked{" "}
              <code>[unclear]</code>, then publish.
            </div>
            {recipe.transcription_notes && (
              <div className="rounded-md border border-neutral-200 p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                <strong>Transcriber notes:</strong> {recipe.transcription_notes}
                <input
                  type="hidden"
                  name="transcription_notes"
                  value={recipe.transcription_notes}
                />
              </div>
            )}
            <label className="text-sm font-medium">
              Title
              <input
                name="title"
                defaultValue={recipe.title ?? ""}
                required
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="text-sm font-medium">
              Attribution
              <input
                name="attribution"
                defaultValue={recipe.attribution ?? ""}
                placeholder='e.g. "Mona&apos;s" or "from Aunt Ruth"'
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="text-sm font-medium">
              Category
              <select
                name="category"
                defaultValue={recipe.category ?? "Odds & Ends"}
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Tags (comma-separated)
              <input
                name="tags"
                defaultValue={recipe.tags.join(", ")}
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <label className="text-sm font-medium">
              Transcription (markdown)
              <textarea
                name="body_md"
                defaultValue={recipe.body_md ?? ""}
                rows={18}
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>
            <div className="flex gap-3">
              <button
                name="intent"
                value="publish"
                className="flex-1 rounded-md bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800"
              >
                Publish
              </button>
              <button
                name="intent"
                value="save"
                className="rounded-md border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700"
              >
                Save draft
              </button>
            </div>
          </form>
        ) : (
          <article>
            <div className="flex items-baseline justify-between gap-3">
              <h1 className="text-2xl font-bold">
                {recipe.title ?? "Untitled recipe"}
              </h1>
              {recipe.status !== "published" && (
                <span className="text-sm uppercase text-neutral-400">
                  {recipe.status}
                </span>
              )}
            </div>
            {recipe.attribution && (
              <p className="mt-1 italic text-neutral-500">{recipe.attribution}</p>
            )}
            <p className="mt-1 text-sm text-neutral-500">
              {recipe.category}
              {recipe.tags.length > 0 && ` · ${recipe.tags.join(", ")}`}
            </p>
            <div className="prose prose-neutral mt-4 max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {recipe.body_md ?? ""}
              </ReactMarkdown>
            </div>
          </article>
        )}
      </div>

      {isUploader && (
        <form action={deleteRecipe} className="mt-10">
          <input type="hidden" name="recipe_id" value={recipe.id} />
          <input type="hidden" name="back_to" value={backTo} />
          <button className="text-sm text-red-600 hover:underline">
            Delete this recipe
          </button>
        </form>
      )}
    </main>
  );
}
