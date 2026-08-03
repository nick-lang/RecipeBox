"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Phase = "idle" | "uploading" | "transcribing" | "error";

/** Downscale to keep uploads and vision-model costs reasonable. */
async function downscaleImage(file: File, maxEdge = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === "image/jpeg") return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      0.87
    )
  );
}

export default function UploadPage(props: {
  params: Promise<{ groupId: string; collectionId: string }>;
}) {
  const { groupId, collectionId } = use(props.params);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    setPhase("uploading");
    const supabase = createClient();

    try {
      const jpeg = await downscaleImage(file);

      const { data: recipe, error: insertError } = await supabase
        .from("recipes")
        .insert({
          collection_id: collectionId,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          status: "processing",
        })
        .select("id")
        .single();
      if (insertError || !recipe) {
        throw new Error(insertError?.message ?? "Could not create recipe");
      }

      const path = `${groupId}/${recipe.id}/original-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, jpeg, { contentType: "image/jpeg" });
      if (uploadError) throw new Error(uploadError.message);

      const { error: imageError } = await supabase.from("recipe_images").insert({
        recipe_id: recipe.id,
        kind: "original",
        storage_path: path,
      });
      if (imageError) throw new Error(imageError.message);

      setPhase("transcribing");
      const res = await fetch(`/api/recipes/${recipe.id}/process`, {
        method: "POST",
      });
      // Even if transcription failed, go to the recipe page — it shows the
      // failure state and offers a retry.
      if (!res.ok) console.error("process failed", await res.text());
      router.push(`/recipes/${recipe.id}`);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-bold">Add a recipe</h1>
      <p className="mt-2 text-neutral-500">
        Take a photo of the recipe card. Good light and a flat card make for
        the best transcription.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Recipe preview"
          className="mx-auto mt-6 max-h-80 rounded-lg border border-neutral-200 object-contain dark:border-neutral-800"
        />
      )}

      {(phase === "idle" || phase === "error") && (
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-6 w-full rounded-lg bg-amber-700 px-6 py-4 text-lg font-semibold text-white hover:bg-amber-800"
        >
          📷 {phase === "error" ? "Try again" : "Take a photo"}
        </button>
      )}

      {phase === "uploading" && (
        <p className="mt-6 animate-pulse text-lg">Uploading photo…</p>
      )}
      {phase === "transcribing" && (
        <p className="mt-6 animate-pulse text-lg">
          ✍️ Transcribing your recipe — this can take a minute…
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </main>
  );
}
