"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "facebook";

function LoginButtons() {
  const [pending, setPending] = useState<Provider | "email" | null>(null);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  async function signIn(provider: Provider) {
    setPending(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) setPending(null);
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setPending("email");
    setEmailError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setPending(null);
    if (error) setEmailError(error.message);
    else setLinkSent(true);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {authError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Sign-in failed. Please try again.
        </p>
      )}
      <button
        onClick={() => signIn("google")}
        disabled={pending !== null}
        className="rounded-lg border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {pending === "google" ? "Redirecting…" : "Continue with Google"}
      </button>
      <button
        onClick={() => signIn("facebook")}
        disabled={pending !== null}
        className="rounded-lg border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {pending === "facebook" ? "Redirecting…" : "Continue with Facebook"}
      </button>

      <div className="my-2 flex items-center gap-3 text-sm text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        or
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      {linkSent ? (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Check your email — we sent a sign-in link to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={sendMagicLink} className="flex flex-col gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-neutral-300 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            disabled={pending !== null}
            className="rounded-lg border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {pending === "email" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {emailError && (
            <p className="text-sm text-red-600 dark:text-red-400">{emailError}</p>
          )}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Sign in to RecipeBox</h1>
        <p className="mt-2 text-neutral-500">
          Snap a photo of a recipe card — we&apos;ll transcribe it and file it
          in your group&apos;s collection.
        </p>
      </div>
      <Suspense>
        <LoginButtons />
      </Suspense>
    </main>
  );
}
