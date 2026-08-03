# RecipeBox

Snap a photo of a recipe card — RecipeBox transcribes it with a vision model,
categorizes it, and files it in your group's shared cookbook. Public,
multi-user successor to the grandmasRecipes archive.

**Stack:** Next.js (App Router) · Supabase (auth, Postgres + RLS, storage) ·
Claude vision API for transcription · Vercel for hosting. The phone component
is the same web app: the upload page opens the camera directly on mobile
(`capture="environment"`), so no native app is needed.

## Architecture

```
photo (phone camera) ──► Supabase Storage  (private bucket, path <group>/<recipe>/…)
                          │
                          ▼
        POST /api/recipes/[id]/process
                          │  downloads image, runs the active Transcriber
                          ▼
        recipes row: status processing → draft ──► uploader reviews/edits ──► published
```

- **Data model:** `groups` → `group_members` (owner/admin/member) →
  `collections` (e.g. "2026 Cookbook") → `recipes` → `recipe_images`.
  All access enforced by Postgres Row Level Security keyed off group
  membership — see [supabase/migrations](supabase/migrations/).
- **Pipeline:** transcription sits behind the `Transcriber` interface in
  [src/lib/pipeline](src/lib/pipeline/), selected by env vars
  (`TRANSCRIBER`, `TRANSCRIBER_MODEL`) so cost/reliability experiments can
  swap models and prompt versions without code changes. Every recipe stores
  `pipeline_meta` (model, prompt version, token usage, duration) for
  after-the-fact comparison.
- **Review step:** transcriptions land as **drafts**. The uploader compares
  the text against the card image side by side, fixes `[unclear: …]` flags,
  then publishes. Handwritten-card OCR is never 100% — this step is what
  keeps the archive trustworthy.

## Local development

Prereqs: Node 20+, Docker Desktop (for local Supabase), an Anthropic API key.

```sh
npm install
npx supabase start        # boots local Postgres/auth/storage, applies migrations
cp .env.example .env.local
# paste the API URL + anon key that `supabase start` printed, plus ANTHROPIC_API_KEY
npm run dev
```

Local OAuth: Google/Facebook logins need provider apps even locally. For quick
testing you can enable the email provider in `supabase/config.toml` instead —
local Supabase ships with a fake mail server (Inbucket at
http://127.0.0.1:54324) that catches magic links.

To test the camera flow from your phone on the same network:
`npm run dev -- -H 0.0.0.0`, then open `http://<your-ip>:3000`. (Camera
capture works over plain HTTP only for `localhost`; on a LAN IP use
`npx vercel dev` with a tunnel, or just deploy a preview.)

## Production setup

1. **Supabase project** — create one at [database.new](https://database.new),
   then push the schema: `npx supabase link --project-ref <ref> && npx supabase db push`.
2. **OAuth providers** — in Supabase Dashboard → Authentication → Providers:
   - **Google:** create an OAuth client in Google Cloud Console; authorized
     redirect URI is `https://<ref>.supabase.co/auth/v1/callback`.
   - **Facebook:** create an app at developers.facebook.com; same redirect URI.
   - Add your site URL (and `/auth/callback`) under Authentication → URL
     Configuration.
3. **Vercel** — import the repo, set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`. Done.

## Pipeline experiments (planned)

Ground truth lives in the grandmasRecipes project (~350 cards with verified
transcriptions). The experiment harness will compare transcribers —
Claude model tiers, with/without image preprocessing, prompt variants —
on cost per card and fidelity against that ground truth before we commit to
a default. Keep new pipeline work behind the `Transcriber` interface.
