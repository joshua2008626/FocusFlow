# Security review (self-assessed; not an external audit)
- **Data isolation:** RLS on every table (`auth.uid() = user_id`); ownership triggers stop child rows pointing at another user's parents.
- **Secrets:** only `VITE_SUPABASE_URL` and the anon key reach the browser. `SUPABASE_JWT_SECRET` and `LLM_API_KEY` live only on the API host.
- **API:** JWT verified (HS256, audience `authenticated`, expiry enforced); Pydantic limits on lengths and sizes; per-user AI rate limit (in-memory, so use Redis if you run several API instances); CORS restricted to `ALLOWED_ORIGINS`.
- **AI:** the model only returns text. It cannot write to the database; schedule writes need an explicit user click.
- **Known limits:** XP and achievements are written from the browser (a technical user could edit their own). Reminders only fire while the app is open. `achievements` table writes are blocked for users (read-only policy) but `profiles.xp` is user-updatable. No email-confirmation or password policy is configured here: set those in the Supabase dashboard.
- **Not yet done:** dependency audit (`npm audit`, `pip-audit`), penetration testing, load testing.
