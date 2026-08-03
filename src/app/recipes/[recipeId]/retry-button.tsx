"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetryProcessingButton({ recipeId }: { recipeId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/recipes/${recipeId}/process`, { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
      className="mt-2 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
    >
      {busy ? "Retrying…" : "Retry transcription"}
    </button>
  );
}
