/**
 * Pomodoro timer core. Pure functions over a serialisable state object.
 * Time is never counted by ticking; remaining time is always derived from timestamps,
 * so it stays correct across tab throttling, sleep, minimise and page refresh.
 *
 * Persist `TimerState` (localStorage + optionally Supabase) after every transition and
 * call `reconcile()` on load / visibilitychange / focus.
 */

export type Phase = 'focus' | 'short_break' | 'long_break';
export type RunState = 'idle' | 'running' | 'paused';

export interface TimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export const DEFAULT_SETTINGS: TimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

export interface TimerState {
  phase: Phase;
  run: RunState;
  taskId: string | null;
  plannedMs: number;
  /** ms already elapsed before the current running stretch began (from earlier pauses). */
  accumulatedMs: number;
  /** epoch ms when the current running stretch began; null unless running. */
  startedAt: number | null;
  /** epoch ms of the very first start of this session (for the history record). */
  sessionStartedAt: number | null;
  completedFocusSessions: number;
}

/** What the UI should persist to pomodoro_sessions when a session ends. */
export interface SessionRecord {
  kind: Phase;
  taskId: string | null;
  plannedSeconds: number;
  focusedSeconds: number;
  status: 'completed' | 'interrupted';
  startedAt: number;
  endedAt: number;
}

const phaseMs = (phase: Phase, s: TimerSettings) =>
  (phase === 'focus' ? s.focusMinutes : phase === 'short_break' ? s.shortBreakMinutes : s.longBreakMinutes) * 60_000;

export function initialState(settings: TimerSettings = DEFAULT_SETTINGS, taskId: string | null = null): TimerState {
  return {
    phase: 'focus',
    run: 'idle',
    taskId,
    plannedMs: phaseMs('focus', settings),
    accumulatedMs: 0,
    startedAt: null,
    sessionStartedAt: null,
    completedFocusSessions: 0,
  };
}

export function elapsedMs(state: TimerState, now: number): number {
  const running = state.run === 'running' && state.startedAt != null ? now - state.startedAt : 0;
  return Math.min(state.plannedMs, state.accumulatedMs + Math.max(0, running));
}

export function remainingMs(state: TimerState, now: number): number {
  return Math.max(0, state.plannedMs - elapsedMs(state, now));
}

export const isFinished = (state: TimerState, now: number) =>
  state.run === 'running' && remainingMs(state, now) === 0;

export function start(state: TimerState, now: number): TimerState {
  if (state.run === 'running') return state;
  return { ...state, run: 'running', startedAt: now, sessionStartedAt: state.sessionStartedAt ?? now };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.run !== 'running') return state;
  return { ...state, run: 'paused', accumulatedMs: elapsedMs(state, now), startedAt: null };
}

export const resume = start;

function nextPhase(state: TimerState, settings: TimerSettings, finishedFocus: boolean): { phase: Phase; completed: number } {
  if (state.phase !== 'focus') return { phase: 'focus', completed: state.completedFocusSessions };
  const completed = state.completedFocusSessions + (finishedFocus ? 1 : 0);
  const long = finishedFocus && completed % settings.sessionsBeforeLongBreak === 0;
  return { phase: long ? 'long_break' : 'short_break', completed };
}

/**
 * Finish the current session (naturally or by skip/reset) and move to the next phase, idle.
 * Returns the new state plus a record to persist. Only focus sessions with >0 focused time are recorded
 * for analytics; breaks are returned too so history can show them if desired.
 */
export function finish(
  state: TimerState,
  now: number,
  settings: TimerSettings,
  reason: 'completed' | 'interrupted'
): { state: TimerState; record: SessionRecord | null } {
  const focused = Math.round(elapsedMs(state, now) / 1000);
  const record: SessionRecord | null =
    state.sessionStartedAt != null && focused > 0
      ? {
          kind: state.phase,
          taskId: state.taskId,
          plannedSeconds: Math.round(state.plannedMs / 1000),
          focusedSeconds: focused,
          status: reason,
          startedAt: state.sessionStartedAt,
          endedAt: now,
        }
      : null;

  // Interrupting a focus session (reset) stays on focus; skipping a break moves to focus.
  const completedFocus = state.phase === 'focus' && reason === 'completed';
  const next =
    reason === 'interrupted' && state.phase === 'focus'
      ? { phase: 'focus' as Phase, completed: state.completedFocusSessions }
      : nextPhase(state, settings, completedFocus);

  return {
    record,
    state: {
      phase: next.phase,
      run: 'idle',
      taskId: state.taskId,
      plannedMs: phaseMs(next.phase, settings),
      accumulatedMs: 0,
      startedAt: null,
      sessionStartedAt: null,
      completedFocusSessions: next.completed,
    },
  };
}

/**
 * Call on page load, tab visible, and window focus. If the timer expired while the page was
 * hidden/closed, finish it using the true end time (startedAt + remaining) so the recorded
 * duration is not inflated by time spent away.
 */
export function reconcile(
  state: TimerState,
  now: number,
  settings: TimerSettings
): { state: TimerState; record: SessionRecord | null } {
  if (!isFinished(state, now) || state.startedAt == null) return { state, record: null };
  const trueEnd = state.startedAt + (state.plannedMs - state.accumulatedMs);
  return finish(state, trueEnd, settings, 'completed');
}
