import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight">RecipeBox</h1>
      <p className="text-xl text-neutral-500">
        Turn shoeboxes of recipe cards into a living family cookbook. Snap a
        photo, and RecipeBox transcribes and categorizes it — then share
        collections with your church, family, or friends.
      </p>
      <ul className="text-left text-neutral-600 dark:text-neutral-400">
        <li>📷 Upload recipes by taking a picture with your phone</li>
        <li>✍️ Faithful transcription — quirky spellings and margin notes kept</li>
        <li>👥 Groups with shared collections, like a &ldquo;2026 Cookbook&rdquo;</li>
      </ul>
      <Link
        href="/login"
        className="rounded-lg bg-amber-700 px-6 py-3 font-semibold text-white hover:bg-amber-800"
      >
        Get started
      </Link>
    </main>
  );
}
