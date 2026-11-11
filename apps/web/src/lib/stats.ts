/** Pure analytics helpers. All inputs come from real study_logs rows. */
export interface Log { log_date: string; minutes: number; subject_id?: string | null }
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function minutesByDay(logs: Log[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) m.set(l.log_date, (m.get(l.log_date) ?? 0) + l.minutes);
  return m;
}

/** Consecutive study days ending today (or yesterday, so today's streak isn't lost before you study). */
export function currentStreak(logs: Log[], today: Date): number {
  const days = minutesByDay(logs); let d = new Date(today); let n = 0;
  if (!days.has(iso(d))) d.setUTCDate(d.getUTCDate() - 1);
  while (days.has(iso(d))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
}

export function lastNDays(logs: Log[], n: number, today: Date): { day: string; minutes: number }[] {
  const m = minutesByDay(logs); const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(today); d.setUTCDate(d.getUTCDate() - i); out.push({ day: iso(d), minutes: m.get(iso(d)) ?? 0 }); }
  return out;
}

export function minutesBySubject(logs: Log[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) { const k = l.subject_id ?? 'none'; m.set(k, (m.get(k) ?? 0) + l.minutes); }
  return m;
}
