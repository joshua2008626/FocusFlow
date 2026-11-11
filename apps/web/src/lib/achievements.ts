/** Achievement rules. Rewards consistency and healthy habits, never raw hours or skipped breaks. */
export interface AchStats { completedFocusSessions: number; longestStreak: number; completedTasks: number; distinctSubjectsStudied: number }
export const RULES: Record<string, (s: AchStats) => boolean> = {
  first_focus: s => s.completedFocusSessions >= 1,
  consistency_7: s => s.longestStreak >= 7,
  task_master_25: s => s.completedTasks >= 25,
  deep_focus_10: s => s.completedFocusSessions >= 10,
  subject_explorer: s => s.distinctSubjectsStudied >= 5,
};
export const unlockedCodes = (s: AchStats) => Object.entries(RULES).filter(([, f]) => f(s)).map(([c]) => c);

/** Longest run of consecutive study days (YYYY-MM-DD strings). */
export function longestStreak(days: string[]): number {
  const u = [...new Set(days)].sort(); let best = 0, run = 0, prev = 0;
  for (const d of u) { const t = Date.parse(d + 'T00:00:00Z'); run = prev && t - prev === 864e5 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  return best;
}
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 100)) + 1;
