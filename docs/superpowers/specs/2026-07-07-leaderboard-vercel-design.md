# Shared Leaderboard + Vercel Hosting — Design Spec

## Goal

Let players submit their name and lap time to a shared, public leaderboard visible to everyone, and host the game on Vercel.

## Architecture

The game is currently a pure client-side Vite/TypeScript app with no backend. A shared leaderboard requires persistent storage visible to all players, so this adds:

- **Hosting/API**: Vercel Serverless Functions under an `/api` directory. Vercel auto-detects Vite as the frontend framework and deploys files under `/api` as serverless functions alongside it — no framework migration (e.g. to Next.js) needed.
- **Database**: Vercel Postgres (managed, via Neon), accessed from the serverless functions using the `@vercel/postgres` package.
- **Endpoints**:
  - `GET /api/scores` — returns the top 10 fastest lap times (name, time in ms, submitted-at), ordered ascending by time.
  - `POST /api/scores` — accepts `{ name: string, timeMs: number }`, validates it, inserts a row, returns the current top 10.
- **Local development**: `vercel dev` runs the Vite frontend and the `/api` serverless functions together against a local/dev database. Plain `npm run dev` (Vite only) still works for frontend-only iteration but the leaderboard calls will fail without `vercel dev` or a deployed API.

## Data model

Single Postgres table `scores`:

| column      | type                     | notes                              |
|-------------|--------------------------|-------------------------------------|
| id          | serial primary key       |                                      |
| name        | varchar(20) not null     | trimmed, 1-20 chars, no HTML rendered unsafely |
| time_ms     | integer not null         | must be a positive finite integer, sanity-capped (e.g. under 30 minutes) |
| created_at  | timestamptz default now()|                                      |

Every submission is kept (no per-name dedup) — the board simply shows the 10 lowest `time_ms` rows. This is intentionally simple per the "trust-based, no anti-cheat" decision; the server still validates input shape/bounds (not lap legitimacy) since that's basic request validation, not anti-cheat.

## Frontend changes

- New `src/ui/leaderboard.ts`:
  - `NameEntryOverlay`: DOM overlay shown when `LapTimer.isFinished()` becomes true. Text input (name, max 20 chars) + submit button. On submit, POSTs to `/api/scores`, then shows the leaderboard board with the fresh top 10. Rendered via safe DOM APIs (`textContent`, not `innerHTML`) for any user-supplied name to prevent stored XSS.
  - `LeaderboardBoard`: DOM overlay listing rank, name, and formatted time for the top 10. Toggleable any time with the `L` key (in addition to auto-showing right after a submission).
- New `src/api/scoresClient.ts`: thin fetch wrapper — `submitScore(name, timeMs): Promise<ScoreEntry[]>` and `fetchTopScores(): Promise<ScoreEntry[]>`, both pure/mockable for testing (no DOM access), sharing a `ScoreEntry` type (`{ name: string; timeMs: number }`) with the API.
- `src/main.ts`: wire `L` key (via a new `InputState.leaderboardTogglePressed` one-shot flag, same pattern as `resetPressed`) to toggle the board; wire lap-finish detection (edge-triggered transition of `LapTimer.isFinished()`) to show the name-entry overlay once per finish.

## Backend changes

- `api/scores.ts` (Vercel serverless function, Node.js runtime): handles `GET` and `POST` as described above. Validates on POST: `name` is a non-empty trimmed string ≤20 chars (reject/truncate otherwise), `timeMs` is a finite number `> 0` and `< 30 * 60 * 1000` (reject otherwise with a 400).
- `api/_db.ts`: small helper wrapping `@vercel/postgres`'s `sql` tagged-template client and a `ensureSchema()` function that creates the `scores` table if it doesn't exist (called lazily on first request — avoids needing a separate manual migration step for this small project).
- `package.json`: add `@vercel/postgres` dependency, add a `vercel.json` if needed for function config (likely unnecessary — Vercel's zero-config Vite + `/api` detection should suffice).

## Testing approach

- Unit tests (Vitest) for `src/api/scoresClient.ts` using a mocked `fetch`, and for any pure validation logic factored out (e.g. a shared `validateScoreSubmission(name, timeMs)` function used by both the client, to give immediate feedback, and the server, for enforcement).
- Manual verification: since real end-to-end testing requires a live Postgres instance and Vercel deployment (both need the user's account), full-stack verification happens after the user provisions the database and either runs `vercel dev` locally or deploys — this is called out explicitly as a manual step, not something automatable in this environment.

## Deployment (user-driven)

I can prepare all code and configuration, but the following steps require the user's own Vercel account and cannot be done autonomously:
1. `vercel login` (interactive auth)
2. `vercel link` (connect this project to a Vercel project)
3. Provision a Vercel Postgres database (via the Vercel dashboard or `vercel postgres create`) and connect it to the project
4. `vercel env pull` (pulls DB connection env vars for local dev, if using `vercel dev`)
5. `vercel deploy --prod` (or push to a connected Git repo for auto-deploy)

I'll write these as clear step-by-step instructions once the code is ready, and can run any individual command alongside the user interactively if they want to do it together in this session.

## Out of scope

- Anti-cheat / server-side lap-time verification beyond basic input bounds (per the "trust-based" decision)
- Per-track leaderboards (only one track exists currently; schema can be extended later if more tracks are added)
- User accounts/auth — name is freely typed each time, no identity persistence
- Editing or deleting past leaderboard entries (no admin UI)
