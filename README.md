# TikTok Plans

A library-first planning MVP built on the existing Next.js App Router application. Collect a place once, let AI organize the supplied content, discover outing suggestions from your actual library, and generate a plan with friends. Independent of and unaffiliated with TikTok.

## Run and try it

Node.js 24.19.0 (`.nvmrc`) and npm 11 are used in the cloud environment.

```sh
cd /workspace/tiktok-plans
npm ci --cache /tmp/tiktok-plans-npm --no-audit --no-fund
npm run dev
```

The app serves on port **3000**. Use the existing checkout; each cloud task is already isolated and does not need a Git worktree. For production, `npm run build` then `npm start`. Only start one development server for this checkout.

Without keys, the full local library, correction/edit/delete controls, search/grouping, duplicate detection, sample collections, sample planner, and local crew/voting work. Real text imports pause with an explicit configuration error; bare links request context. **There is no fake AI fallback for real imports.**

For local live integration, copy `.env.example` to `.env.local`, supply credentials there, and restart. In cloud, use secure environment settings instead. Never paste keys into chat or commit `.env.local`.

| Setting                         | Required for                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `PLANS_OPENAI_API_KEY`          | Real structured extraction and AI itinerary priorities                            |
| `PLANS_OPENAI_MODEL`            | Optional structured-output/vision model override; default `gpt-4.1-mini`          |
| `GOOGLE_MAPS_API_KEY`           | Google Places API (New), location matching, addresses, coordinates and hours      |
| `PLANS_ENABLE_ROUTES=true`      | Use the Maps key with Google Routes API enabled                                   |
| `GOOGLE_ROUTES_API_KEY`         | Optional separate server key for Routes; takes precedence over the Maps key       |
| `PLANS_ENABLE_STATIC_MAPS=true` | Optional Maps Static API image, proxied through the server without exposing a key |
| `PLANS_MAX_AI_CALLS_PER_HOUR`   | Process-wide AI allowance, default 30, capped at 100                              |

The app can also use an existing server-side `OPENAI_API_KEY`. The cloud configuration uses `PLANS_OPENAI_API_KEY` because the `OPENAI_` prefix is reserved for new secret bindings. No key is prefixed with `NEXT_PUBLIC_`. In this cloud draft, the existing Maps secret permits Places and Routes. To enable optional map images, edit that same secret’s allowed destinations in environment settings to also include `maps.googleapis.com`; preserve the existing destinations. The draft API cannot change an existing secret target, and no duplicate secret was added. Enable billing and restrict Google keys to the APIs and server environment you use. Required outbound hosts are `api.openai.com`, `places.googleapis.com`, and, when enabled, `routes.googleapis.com` and `maps.googleapis.com`.

Video processing needs FFmpeg and ffprobe on the server PATH; both are available in this cloud image. No database, real authentication, TikTok account connection, or native share extension is required or implemented.

## Test the product flow

1. Open **My Places → Collect a place**. Paste several public TikTok video/short links, one per line. Add a description or transcript with each link using `URL | description`, or use the common context field. Alternatively, paste descriptions without links, separating experiences with blank lines.
2. Include what you actually know: business name, city, experience, and explicit cost/currency where available. AI does not view TikTok links. A source lacking a name/city asks for clarification; an unsupported price stays unknown.
3. For videos you own or have permission to process, upload MP4, MOV, or WebM. Confirm permission and that audio/frames will be sent to OpenAI. Files must be no more than **12 MB, 90 seconds, and 4096 pixels**; the UI accepts up to three files per batch. Originals are temporary and removed server-side; they are not persisted in the browser either. If interrupted, re-import the file or add text context.
4. Imports progress through **queued → processing → ready / needs review / failed** automatically. Review uncertain extraction fields. Choose the correct Google listing when alternatives appear. Saving new source context re-runs AI; saving field corrections retries verification. Refresh status / retry processing resumes paused items in bulk.
5. Return to the homepage. Suggestions are derived from the current library, grouped by saved city and a 4 km coordinate cluster when available. Deleting or adding places changes suggestions. Samples remain separate. Unverified groupings explicitly say feasibility still needs checking.
6. Choose an outing or select places in the library and click **Generate Plan**. The essential inputs are the date and time window. Editable defaults are USD 50/person, walking, and an easygoing pace. Blank origin means you start at the first scheduled venue; travel to it is excluded.
7. For real planning, every selected place needs a confirmed Google location, visit-duration estimate, and enough cost/opening information. Add a user-confirmed availability window in the place editor if date-specific opening hours are missing. Regular hours and unknown prices can be allowed explicitly, but produce a **provisional** draft.
8. Edit preferences, lock must-visits, remove activities, reorder with pointer/keyboard/arrows, and regenerate. Manual live-plan edits invalidate timing; **Check edited order** revalidates it. Impossible constraints return explanations and alternatives instead of a misleading schedule. Omitted optional activities are explained. Locked activities remain required and preserve relative order; an infeasible lock causes an error.
9. Add local crew members, vote as yourself, and copy a text summary. No invitation is sent, no account is created, and no cross-device synchronization occurs.

Costs are source/user estimates, not bookings or verified prices. Published hours and Google route estimates do not establish reservations, real-time availability, traffic, or queues. Transit routing currently uses a current baseline, **not a timetable for the selected date**, so transit plans remain provisional. Without Routes, travel is a clearly labeled straight-line estimate with a buffer and the plan remains provisional.

## Architecture

This extends the original app; the original overview, named blank-plan flow, sample video selection, preferences, drag/lock/remove controls, local members, voting, and persistence remain available. `/videos` is a compatible alias for the new `/places` screen. Blank manual plans use the explicit sample workflow; real AI plans start from verified library collections.

```text
src/components/library-provider.tsx   Independent local Places Library and automatic queue
src/components/import-places.tsx      Batch links, text, and permitted video collection
src/components/places-library.tsx     Search, filters, grouping, selection, and place cards
src/components/place-editor.tsx       Corrections, evidence, matches and availability
src/components/library-home.tsx       Suggestions calculated from actual library contents
src/components/generate-plan.tsx      Quick plan generation with editable defaults
src/components/plan-*.tsx              Existing plan state/workspace, extended for real plans
src/lib/library-types.ts              Zod schemas and typed service/result contracts
src/lib/library-storage.ts            Persistence adapter and one-time legacy migration
src/lib/suggestions.ts                Deterministic city/geographic grouping
src/lib/server/openai.ts              Structured Responses API extraction and AI priorities
src/lib/server/media.ts               Bounded FFmpeg frames/audio; temporary cleanup
src/lib/server/pipeline.ts            Extraction → uncertainty → verification orchestration
src/lib/server/google-places.ts       Google Places search, details and conservative matching
src/lib/server/routes.ts              Google Routes matrix or labeled distance estimates
src/lib/server/scheduler.ts           Deterministic time, hours, travel, cost and lock checks
src/lib/server/itinerary.ts           Fresh verification, AI priorities and scheduler integration
src/lib/server/guards.ts              Input limits, same-origin checks, concurrency and cost caps
src/app/api/                          Server-only process, verify, details, itinerary, map, capabilities
```

AI reasons about preferences and ordering. The deterministic scheduler chooses a feasible subset and schedule; the model cannot invent travel times or bypass locks/budgets. It checks all selected candidates (up to six), may wait for a verified opening window, and explains optional omissions. Must-visit locks cannot silently disappear. Existing data-access interfaces remain replaceable by Supabase adapters.

## Persistence and Google content

Existing plans stay in `tiktok-plans:v1`; independent places use `tiktok-plans:places:v1`. The first load migrates legacy plan videos once without deleting the originals. Samples retain their sample labels. Deleting a library entry does not erase stop snapshots or other plans; a real plan referencing a deleted place must remove it or restore/re-import it before rechecking.

Persisted place records contain user-supplied content, AI extraction, user corrections, estimates, processing state, and **Google Place IDs only**. Google addresses, coordinates, hours, match alternatives, map images and route matrices are not saved to localStorage or disk. Provider requests use `no-store`; display data stays in memory and is refreshed after reload. Google/third-party attribution accompanies listing details. Map images retain their original Google branding and are not cropped. Maps/directions use Google Maps.

Live schedule data derived from Google hours/routes is also kept in memory only. Saved live plans retain user preferences, place/stop IDs, order, votes, and locks; after a reload, timing is marked stale and must be regenerated. Do not treat persistence of a Place ID as fresh opening-hours verification. See [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) and [Routes policies](https://developers.google.com/maps/documentation/routes/policies) when extending storage/export behavior.

Storage errors preserve session changes and do not silently overwrite unreadable saved data. Google data is not included in copied plan summaries.

## Limits and deployment boundary

The server accepts up to 10 imports per client batch, 12,000 characters per context, six places per outing, bounded request bodies, and two concurrent processing/planning jobs. A video sends at most four low-detail frames and one transcription request. AI output tokens and SDK retries are bounded (`maxRetries: 0`). No arbitrary media URL fetches, TikTok scraping, remote playlists, or model tool execution are implemented.

Server allowances are process-wide: 100 guarded requests/hour, 30 AI calls/hour by default, and 150 Google cost units/hour. Matrix elements count individually toward the Google allowance (up to 49 with an origin). These are cost controls, **not authentication or durable billing limits**; restarting or scaling the server creates new allowances. Before exposing credential-enabled endpoints publicly, add authentication, per-user durable quotas, a persistent job queue, and abuse controls. The current application is a local-persistence MVP.

## Validation and what is not yet live-verified

```sh
npm run typecheck
npm run lint
npm run build
npm run format:check
npm run test:e2e
```

Playwright starts a dev server if needed. The cloud image's Chromium is used when available; otherwise install managed Chromium with `npx playwright install chromium`. The mobile project emulates an iPhone in Chromium, not real Safari. Tests cover legacy flows, the new library-first flow, ambiguous matches, duplicate/invalid imports, missing-key behavior, edit/regenerate/lock failures, storage restrictions, accessibility, deterministic scheduling and local FFmpeg processing.

Provider-backed success paths use **controlled test fixtures**, explicitly labeled in the tests; there is no production fixture mode. This environment initially has no OpenAI or Maps keys, so successful live OpenAI extraction, transcription, Google verification, Routes and Static Maps calls have **not** been verified. Missing-key responses, actual local media processing, local UI behavior, and fixture-driven integration are independently testable. Samples never call live providers. Add credentials to run the live flow; no success should be inferred from a configured flag alone.

Next: Supabase-backed ownership and persistence, authentication and durable quotas/queues, native share intake, richer activity preferences, date-specific transit routing, and real-time invitations/votes. Native TikTok Favorites access would require an authorized supported integration; private scraping is not a substitute.

## Assets

DM Sans is from Google Fonts under the SIL Open Font License (`public/fonts/OFL.txt`). Existing illustrative sample photos are bundled from the public Bedimcode [coffee](https://github.com/bedimcode/responsive-coffee-website), [restaurant](https://github.com/bedimcode/responsive-website-restaurant), and [travel](https://github.com/bedimcode/responsive-travel-website) demo assets. Photos are not claimed to depict the named venues.

## Deploy on Vercel

Import this GitHub repository into Vercel as a **Next.js** project. Use the repository root, the default `npm run build` build command, and the default output directory. The sample/local-data experience can be deployed without API credentials. Add live provider keys only through Vercel's server-side environment-variable settings.

Vercel deployment does not automatically include the cloud workspace's FFmpeg installation. The capability check disables video uploads when media tools are unavailable; text descriptions and transcripts remain supported. For hosted video ingestion, use a dedicated media worker and direct-to-storage uploads rather than relying on serverless request-body limits. The local filesystem and process-local rate limits are not a shared production backend.

After connecting Vercel to this repository, pushes to the production branch can trigger deployments automatically. Vercel account authorization is required to create the project or deploy from the CLI; GitHub access alone does not supply it.
