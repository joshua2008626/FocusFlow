import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS as S, initialState, start, pause, resume, remainingMs, finish, reconcile } from './timer';

const T0 = 1_700_000_000_000;
const min = (m: number) => m * 60_000;

describe('timer accuracy', () => {
  it('derives remaining time from timestamps, not ticks', () => {
    const s = start(initialState(), T0);
    expect(remainingMs(s, T0 + min(10))).toBe(min(15));
  });

  it('pause freezes progress and resume continues from it', () => {
    let s = start(initialState(), T0);
    s = pause(s, T0 + min(5));
    expect(remainingMs(s, T0 + min(60))).toBe(min(20)); // time paused does not count
    s = resume(s, T0 + min(60));
    expect(remainingMs(s, T0 + min(70))).toBe(min(10));
  });
});

describe('session recording', () => {
  it('completes a focus session and moves to a short break', () => {
    const s = start(initialState(), T0);
    const { state, record } = finish(s, T0 + min(25), S, 'completed');
    expect(record).toMatchObject({ kind: 'focus', status: 'completed', focusedSeconds: 1500 });
    expect(state.phase).toBe('short_break');
    expect(state.completedFocusSessions).toBe(1);
    expect(state.run).toBe('idle');
  });

  it('gives a long break after the fourth focus session', () => {
    let s = initialState();
    for (let i = 0; i < 4; i++) {
      s = start({ ...s, phase: 'focus', plannedMs: min(25) }, T0);
      s = finish(s, T0 + min(25), S, 'completed').state;
      if (i < 3) expect(s.phase).toBe('short_break');
    }
    expect(s.phase).toBe('long_break');
    expect(s.plannedMs).toBe(min(15));
  });

  it('records an interrupted focus session with partial time and stays on focus', () => {
    const s = start(initialState(), T0);
    const { state, record } = finish(s, T0 + min(7), S, 'interrupted');
    expect(record).toMatchObject({ status: 'interrupted', focusedSeconds: 420 });
    expect(state.phase).toBe('focus');
    expect(state.completedFocusSessions).toBe(0);
  });

  it('does not record a session that never ran', () => {
    expect(finish(initialState(), T0, S, 'interrupted').record).toBeNull();
  });
});

describe('reconcile after refresh or sleep', () => {
  it('completes an expired session using its true end time', () => {
    const s = start(initialState(), T0);
    const { state, record } = reconcile(s, T0 + min(90), S); // user was away for 90 min
    expect(record?.focusedSeconds).toBe(1500);
    expect(record?.endedAt).toBe(T0 + min(25));
    expect(state.phase).toBe('short_break');
  });

  it('leaves a still-running timer untouched', () => {
    const s = start(initialState(), T0);
    expect(reconcile(s, T0 + min(3), S).state).toBe(s);
  });
});
