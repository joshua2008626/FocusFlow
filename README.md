# FocusFlow: Plan Smarter. Focus Deeper. Learn Better.

Academic productivity platform: tasks, subjects, Pomodoro focus, deterministic study scheduling, revision, analytics, and an optional AI assistant.

## Status (honest)
| Area | State |
|---|---|
| Supabase schema + RLS (`supabase/migrations/0001_init.sql`) | Written, **not yet applied/tested** against a live project |
| Priority engine, timer core (`apps/web/src/lib`) | Written with Vitest tests; all 25 test cases (priority, timer, stats, achievements) **pass** when run on Node 22 with a minimal Vitest shim (real `vitest run` not yet executed) |
| Scheduler + revision engines (`apps/api/app`) | Written; 6 tests **pass** (run with plain Python) |
| FastAPI: JWT auth, rate limit, `/schedule/propose`, `/ai/chat` | Written, **not yet run** (deps not installable in the build sandbox); AI call untested with a real provider |
| Type check | Frontend source type-checked with `tsc --strict` against minimal library stubs (React, Supabase, Recharts, FullCalendar, Framer Motion): no errors in app logic after two fixes. This is not a substitute for a real `npm run build` with the real type packages. |
| Frontend | Auth (sign up/in/reset), theme switch, Dashboard from real data (today, streak, goal, week chart, deadlines, today's schedule, subject progress, 'Recommended next' from the deterministic priority engine), Subjects/topics/exams with 'Topics to revise' (spaced repetition, revision history saved), Weekly challenges (Mon-Sun, real data, consistency-based), hash routing (refresh keeps your tab), animated landing hero (Framer Motion), `vercel.json`, `render.yaml`, GitHub Actions CI, Calendar (FullCalendar month/week/day; study blocks, deadlines, exams, custom events; drag to reschedule; reminders via browser notifications + in-app banner), full landing page (features, how it works, sample testimonials, FAQ, footer), Kanban board (drag between and within columns, order persisted in `sort_order`; subtasks), Rewards (XP, level, 5 achievements, unlocked from real data), Settings (profile, daily goal, timer durations used by the timer), Analytics page (7/30/90/custom, bar, pie, heatmap, completion rates, planned vs actual), Planner (calls API, shows proposal + warnings, saves only on approval), Flow AI chat (server-side, clear unconfigured message), Task manager (CRUD, search, priority engine with reasons), Pomodoro timer (persisted, DB-backed history). **Written but never compiled or run.** |
| Backend API tests (`apps/api/tests/test_api.py`) | Written, **never run** (fastapi/pytest not installable in the build sandbox) |
| Tailwind | Installed and configured (preflight off); the app is still mostly styled by `src/styles.css` tokens, with Tailwind utilities used in the landing previews |
| **Not built yet / known gaps** | screenshots (none were taken: the app was never run), full Tailwind migration, background push reminders, deploying and verifying end to end |

## Stack
React + TS + Vite, Tailwind/Framer Motion/Recharts (to be wired), FastAPI + Pydantic, Supabase Postgres + Auth.

## Architecture
- Scheduling is deterministic (`scheduler.py`). It returns a **proposal** (`requires_approval: true`); the client saves to `schedules` only after the user approves.
- The LLM is only reached through `/ai/chat` (server-side key, per-user rate limit, 503 with a clear message when unconfigured).
- Timer state is timestamp-based and persisted; `reconcile()` finishes expired sessions on load.
- Every user table has RLS (`auth.uid() = user_id`) plus an ownership trigger for parent references.

## Setup
1. Create a Supabase project; run `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`).
2. `cp apps/web/.env.example apps/web/.env` and `cp apps/api/.env.example apps/api/.env`; fill in values (JWT secret: Supabase > Project Settings > API).
3. Web: `cd apps/web && npm install && npm run dev`
4. API: `cd apps/api && pip install -r requirements.txt && uvicorn app.main:app --reload`

## Tests
- Web: `cd apps/web && npm test`
- API: `cd apps/api && pytest`

## Deployment
Web to Vercel (root `apps/web`, set `VITE_*` vars). API to Render (start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, set API vars). Never put `LLM_API_KEY` in the frontend.

## Database structure
`profiles` (1:1 with auth.users, settings and XP) → `subjects` → `topics` (difficulty, importance, confidence, revision state) and `exams`; `tasks` → `subtasks`; `pomodoro_sessions` and `study_logs` (time tracking); `schedules` (approved plan blocks), `calendar_events`, `reminders`; `goals`, `revision_records`; `achievements` (global catalog, read-only) → `user_achievements`. All user tables: PK, FKs with cascade rules, CHECK constraints, indexes, `updated_at` triggers, RLS.

## Demo walkthrough (no screenshots available)
1. Landing page: try the sample timer and planner preview, click Start Your Journey, sign up.
2. Subjects: add a subject, topics and an exam date. Tasks: add tasks with deadlines and estimates; see the priority score with reasons.
3. Planner: generate a plan, review warnings, approve it. Calendar: see blocks, deadlines and exams; drag to reschedule.
4. Focus: pick a task, run a session; Home and Analytics update from the saved records. Rewards: unlock First Focus.
5. Flow AI: shows a configuration message until `LLM_API_KEY` is set on the API.

See `SECURITY.md` for the security notes.

## Limitations
- Built on free tiers (Supabase, Vercel). Sign-up and password-reset emails are rate-limited, and an inactive free Supabase project can pause.
- Planner and Flow AI require the FastAPI backend, which is not deployed in the live demo.
- Reminders only fire while the app is open in the browser (no background push).
- Early version: not load-tested or externally security-audited. XP and achievements are computed client-side.
