# Roadmap to Live

Steps run in order. Each is tagged **[me]** (Claude does it), **[you]**
(needs Nick), or **[both]**.

## Phase 1 — Finish local (works fully on this machine)

1. **[me] Email magic-link sign-in.** Add email login alongside Google/
   Facebook. Locally, links land in Mailpit (http://127.0.0.1:55324) so the
   full UI flow is testable without OAuth apps; in production it's the
   fallback for people without Google/Facebook.
2. **[you] Anthropic API key.** Put your key in `.env.local`
   (`ANTHROPIC_API_KEY=sk-ant-...`). Get one at console.anthropic.com →
   API Keys if needed.
3. **[me] Local end-to-end proof.** Sign in via magic link, create a group +
   collection, upload a real card scan from grandmasRecipes, verify
   transcription → draft → review → publish. Fix whatever breaks.

## Phase 2 — Hosted backend

4. **[you] Create the Supabase project.** At https://database.new (free
   tier). Pick a region near you, set a DB password and save it. Then give
   me: the **project ref** (the `xyz` in `xyz.supabase.co`) and the **anon
   key** (Project Settings → API Keys). I'll need the DB password at the
   terminal when pushing.
5. **[me] Push the schema.** `supabase link` + `supabase db push`, then
   sanity-check tables/policies in the hosted project.
6. **[you] OAuth provider apps.** (Can be deferred — magic-link login means
   the app works without this, but Google login is table stakes for a
   public app. Facebook can wait.)
   - **Google:** console.cloud.google.com → new project → OAuth consent
     screen (External) → Credentials → OAuth client ID (Web app). Authorized
     redirect URI: `https://<ref>.supabase.co/auth/v1/callback`. Paste the
     client ID + secret into Supabase Dashboard → Authentication →
     Providers → Google.
   - **Facebook:** developers.facebook.com → new app → Facebook Login →
     same redirect URI → App ID + secret into Supabase → Providers →
     Facebook.

## Phase 3 — Deploy

7. **[me, with your OK] GitHub repo.** Create a private repo under
   nick-lang and push.
8. **[both] Vercel.** You create/log into a Vercel account and import the
   GitHub repo (or install the Vercel CLI and I'll drive). Env vars:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `ANTHROPIC_API_KEY`.
9. **[me, guided] Auth URL config.** In Supabase → Authentication → URL
   Configuration: set Site URL to the Vercel URL, add
   `https://<app>.vercel.app/auth/callback` to redirect URLs.
10. **[both] Production smoke test.** Sign in on your phone, create a group,
    photograph a real card, publish it. Invite a second account via code.

## Phase 4 — Post-live: pipeline experiments

11. **[me] Experiment harness.** Run sample cards from grandmasRecipes
    through transcriber variants (model tiers × prompt versions × with/
    without preprocessing), score against the ~350 verified transcriptions
    for cost-per-card and fidelity. Pick the default; keep the interface
    swappable.

## Backlog (not blocking launch)

- Image cleanup step (port autocrop.py or test whether models need it at all)
- Multi-photo recipes (front/back of card, continuation pages)
- Search within groups (title/body/tags)
- Group cookbook export (printable PDF for the church 2026 cookbook)
- Roles UI (promote to admin, remove members), leave group
- Recipe visibility options (public sharing links)
- Custom domain
