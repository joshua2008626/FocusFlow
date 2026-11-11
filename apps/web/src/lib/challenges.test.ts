import { describe, it, expect } from 'vitest';
import { progress, weekStart } from './challenges';
describe('challenges', () => {
  it('week starts on Monday', () => {
    expect(weekStart(new Date('2026-11-11T15:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-09');
    expect(weekStart(new Date('2026-11-15T23:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-09');
    expect(weekStart(new Date('2026-11-09T00:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-09');
  });
  it('caps progress at the target and flags completion', () => {
    const p = progress({ studyDays: 9, focusSessions: 2, tasksCompleted: 3, topicsRevised: 0 });
    expect(p[0].value).toBe(4); expect(p[0].done).toBe(true); expect(p[1].done).toBe(false); expect(p[2].done).toBe(true);
  });
});
