import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Collection, Recipe } from "@/lib/types";

export default async function CollectionPage(props: {
  params: Promise<{ groupId: string; collectionId: string }>;
}) {
  const { groupId, collectionId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: collection } = (await supabase
    .from("collections")
    .select("*")
    .eq("id", collectionId)
    .single()) as { data: Collection | null };
  if (!collection || collection.group_id !== groupId) notFound();

  const { data: recipes } = (await supabase
    .from("recipes")
    .select("*")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false })) as { data: Recipe[] | null };

  // Signed thumbnail URLs for each recipe's first image (bucket is private).
  const recipeIds = (recipes ?? []).map((r) => r.id);
  const thumbs = new Map<string, string>();
  if (recipeIds.length > 0) {
    const { data: images } = await supabase
      .from("recipe_images")
      .select("recipe_id, storage_path")
      .in("recipe_id", recipeIds)
      .eq("kind", "original")
      .order("position");
    const firstPaths: { recipe_id: string; storage_path: string }[] = [];
    for (const img of images ?? []) {
      if (!firstPaths.some((p) => p.recipe_id === img.recipe_id)) {
        firstPaths.push(img);
      }
    }
    if (firstPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("recipe-images")
        .createSignedUrls(firstPaths.map((p) => p.storage_path), 3600);
      signed?.forEach((s, i) => {
        if (s.signedUrl) thumbs.set(firstPaths[i].recipe_id, s.signedUrl);
      });
    }
  }

  const statusLabel: Record<Recipe["status"], string> = {
    processing: "⏳ Transcribing…",
    draft: "📝 Draft — needs review",
    published: "",
    failed: "⚠️ Transcription failed",
  };

  return (
    <main className="mx-auto max-w-4xl p-6">
      <p className="text-sm">
        <Link href={`/groups/${groupId}`} className="text-amber-700 hover:underline">
          ← Back to group
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{collection.name}</h1>
          {collection.description && (
            <p className="text-neutral-500">{collection.description}</p>
          )}
        </div>
        <Link
          href={`/groups/${groupId}/collections/${collectionId}/upload`}
          className="rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800"
        >
          📷 Add recipe
        </Link>
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(recipes ?? []).map((r) => (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="block overflow-hidden rounded-lg border border-neutral-200 hover:border-amber-600 dark:border-neutral-800"
            >
              {thumbs.has(r.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbs.get(r.id)}
                  alt={r.title ?? "Recipe card"}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-neutral-100 text-4xl dark:bg-neutral-900">
                  🍲
                </div>
              )}
              <div className="p-3">
                <p className="font-semibold">{r.title ?? "Untitled recipe"}</p>
                <p className="text-sm text-neutral-500">
                  {statusLabel[r.status] || r.category}
                </p>
              </div>
            </Link>
          </li>
        ))}
        {(recipes ?? []).length === 0 && (
          <li className="text-neutral-500">
            No recipes yet — tap &ldquo;Add recipe&rdquo; to photograph the
            first card.
          </li>
        )}
      </ul>
    </main>
  );
}
