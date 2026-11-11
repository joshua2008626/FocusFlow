import { describe, it, expect } from 'vitest';
import { longestStreak, unlockedCodes, levelFromXp } from './achievements';
describe('achievements', () => {
  it('finds the longest consecutive streak', () => {
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-07', '2026-11-08'])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
  it('unlocks by thresholds', () => {
    expect(unlockedCodes({ completedFocusSessions: 10, longestStreak: 7, completedTasks: 24, distinctSubjectsStudied: 5 }).sort())
      .toEqual(['consistency_7', 'deep_focus_10', 'first_focus', 'subject_explorer']);
  });
  it('levels up gradually', () => { expect(levelFromXp(0)).toBe(1); expect(levelFromXp(400)).toBe(3); });
});
