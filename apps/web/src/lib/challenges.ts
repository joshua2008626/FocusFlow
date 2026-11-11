/** Weekly challenges. Targets are modest and consistency-based; nothing rewards longer hours. */
export interface WeekData { studyDays: number; focusSessions: number; tasksCompleted: number; topicsRevised: number }
export const CHALLENGES: { id: string; title: string; target: number; pick: (d: WeekData) => number }[] = [
  { id: 'days', title: 'Study on 4 different days', target: 4, pick: d => d.studyDays },
  { id: 'focus', title: 'Complete 5 focus sessions', target: 5, pick: d => d.focusSessions },
  { id: 'tasks', title: 'Finish 3 tasks', target: 3, pick: d => d.tasksCompleted },
  { id: 'revise', title: 'Revise 4 topics', target: 4, pick: d => d.topicsRevised },
];
/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const dow = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dow); return x;
}
export const progress = (data: WeekData) => CHALLENGES.map(c => ({ ...c, value: Math.min(c.target, c.pick(data)), done: c.pick(data) >= c.target }));
