import { describe, it, expect } from 'vitest';
import { currentStreak, lastNDays, minutesBySubject } from './stats';
const today = new Date('2026-11-10T12:00:00Z');
describe('stats', () => {
  it('counts consecutive days ending today', () => {
    const logs = ['2026-11-10', '2026-11-09', '2026-11-08', '2026-11-05'].map(d => ({ log_date: d, minutes: 20 }));
    expect(currentStreak(logs, today)).toBe(3);
  });
  it('keeps streak alive when today has no study yet', () => {
    expect(currentStreak([{ log_date: '2026-11-09', minutes: 10 }], today)).toBe(1);
  });
  it('is zero with no logs', () => expect(currentStreak([], today)).toBe(0));
  it('fills missing days with zero', () => {
    const r = lastNDays([{ log_date: '2026-11-10', minutes: 30 }], 3, today);
    expect(r.map(x => x.minutes)).toEqual([0, 0, 30]);
  });
  it('groups minutes by subject', () => {
    const m = minutesBySubject([{ log_date: 'x', minutes: 10, subject_id: 'a' }, { log_date: 'x', minutes: 5, subject_id: 'a' }]);
    expect(m.get('a')).toBe(15);
  });
});
