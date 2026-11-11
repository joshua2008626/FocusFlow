import { describe, it, expect } from 'vitest';
import { rankTasks, scoreTask, urgencyFromHours, type PriorityTask } from './priority';

const now = new Date('2026-11-10T09:00:00Z');
const ctx = { now, dailyAvailableMinutes: 180 };
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

const base: PriorityTask = {
  id: 'a',
  title: 'Task',
  deadline: null,
  importance: 3,
  priority: 'medium',
  estimatedMinutes: 60,
  actualMinutes: 0,
  status: 'not_started',
};

describe('urgencyFromHours', () => {
  it('is 1 when due or past due and decays with time', () => {
    expect(urgencyFromHours(0)).toBe(1);
    expect(urgencyFromHours(-5)).toBe(1);
    expect(urgencyFromHours(24)).toBeGreaterThan(urgencyFromHours(120));
  });
});

describe('scoreTask', () => {
  it('returns 0 for completed tasks', () => {
    expect(scoreTask({ ...base, status: 'completed' }, ctx).score).toBe(0);
  });

  it('flags overdue tasks, floors them at 85 and explains why', () => {
    const r = scoreTask({ ...base, deadline: hoursFromNow(-5), priority: 'low', importance: 1 }, ctx);
    expect(r.overdue).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.reasons[0]).toMatch(/Overdue/);
  });

  it('ranks a nearer deadline above a farther one, all else equal', () => {
    const soon = scoreTask({ ...base, id: 's', deadline: hoursFromNow(10) }, ctx);
    const later = scoreTask({ ...base, id: 'l', deadline: hoursFromNow(200) }, ctx);
    expect(soon.score).toBeGreaterThan(later.score);
  });

  it('ranks higher importance above lower when deadlines match', () => {
    const hi = scoreTask({ ...base, deadline: hoursFromNow(48), importance: 5, priority: 'high' }, ctx);
    const lo = scoreTask({ ...base, deadline: hoursFromNow(48), importance: 1, priority: 'low' }, ctx);
    expect(hi.score).toBeGreaterThan(lo.score);
  });

  it('raises pressure when remaining work exceeds available time', () => {
    const heavy = scoreTask({ ...base, deadline: hoursFromNow(24), estimatedMinutes: 600 }, ctx);
    const light = scoreTask({ ...base, deadline: hoursFromNow(24), estimatedMinutes: 30 }, ctx);
    expect(heavy.score).toBeGreaterThan(light.score);
    expect(heavy.reasons.join(' ')).toMatch(/available study time/);
  });

  it('subtracts logged time from remaining effort', () => {
    const r = scoreTask({ ...base, estimatedMinutes: 120, actualMinutes: 90 }, ctx);
    expect(r.reasons.join(' ')).toMatch(/30 min/);
  });

  it('keeps scores within 0-100', () => {
    const r = scoreTask(
      { ...base, deadline: hoursFromNow(-100), importance: 5, priority: 'high', status: 'in_progress', estimatedMinutes: 9999 },
      ctx
    );
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe('rankTasks', () => {
  it('excludes completed tasks and sorts by score descending', () => {
    const ranked = rankTasks(
      [
        { ...base, id: 'done', status: 'completed' },
        { ...base, id: 'later', deadline: hoursFromNow(300) },
        { ...base, id: 'overdue', deadline: hoursFromNow(-2) },
      ],
      ctx
    );
    expect(ranked.map((r) => r.taskId)).toEqual(['overdue', 'later']);
  });
});
