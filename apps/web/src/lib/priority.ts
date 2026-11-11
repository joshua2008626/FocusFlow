/**
 * Smart Priority Engine
 * Pure, deterministic, no network. Returns a 0-100 score and human-readable reasons.
 *
 * score = 100 * clamp( 0.40*urgency + 0.25*importance + 0.15*effortPressure
 *                      + 0.20*capacityPressure ) , overdue tasks get a floor of 85.
 */

export interface PriorityTask {
  id: string;
  title: string;
  deadline: Date | null;
  importance: 1 | 2 | 3 | 4 | 5;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number | null;
  actualMinutes: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface PriorityContext {
  now: Date;
  /** Study minutes the user can realistically spend per day. */
  dailyAvailableMinutes: number;
}

export interface PriorityResult {
  taskId: string;
  score: number;
  overdue: boolean;
  reasons: string[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** Exponential urgency: ~1 when due now, ~0.5 at 2 days, ~0.1 at 7+ days. */
export function urgencyFromHours(hoursLeft: number): number {
  if (hoursLeft <= 0) return 1;
  return clamp(Math.exp(-hoursLeft / 72));
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = minutes / 60;
  return `${h % 1 === 0 ? h : h.toFixed(1)} h`;
}

function fmtTimeLeft(ms: number): string {
  const hours = ms / HOUR;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function scoreTask(task: PriorityTask, ctx: PriorityContext): PriorityResult {
  const reasons: string[] = [];

  if (task.status === 'completed') {
    return { taskId: task.id, score: 0, overdue: false, reasons: ['Already completed'] };
  }

  const remainingMinutes =
    task.estimatedMinutes != null ? Math.max(0, task.estimatedMinutes - task.actualMinutes) : null;

  // --- Urgency ---
  let urgency = 0.1; // no deadline: mild baseline
  let overdue = false;
  let hoursLeft = Infinity;
  if (task.deadline) {
    const msLeft = task.deadline.getTime() - ctx.now.getTime();
    hoursLeft = msLeft / HOUR;
    overdue = msLeft < 0;
    urgency = urgencyFromHours(hoursLeft);
    reasons.push(
      overdue
        ? `Overdue by ${fmtTimeLeft(-msLeft)}`
        : `Due in ${fmtTimeLeft(msLeft)}`
    );
  } else {
    reasons.push('No deadline set');
  }

  // --- Importance (user's 1-5 rating blended with High/Med/Low label) ---
  const labelWeight = { high: 1, medium: 0.6, low: 0.3 }[task.priority];
  const importance = clamp(0.6 * ((task.importance - 1) / 4) + 0.4 * labelWeight);
  if (task.importance >= 4 || task.priority === 'high') reasons.push('Marked as high importance');

  // --- Effort pressure: larger remaining work needs an earlier start ---
  let effortPressure = 0.3;
  if (remainingMinutes != null && remainingMinutes > 0) {
    effortPressure = clamp(remainingMinutes / 240); // 4h+ of remaining work = max
    reasons.push(`About ${fmtDuration(remainingMinutes)} of work remaining`);
  }

  // --- Capacity pressure: remaining work vs. study time available before the deadline ---
  let capacityPressure = 0;
  if (remainingMinutes != null && remainingMinutes > 0 && task.deadline && !overdue) {
    const daysLeft = Math.max(hoursLeft / 24, 1 / 24);
    const availableMinutes = Math.max(daysLeft, 1) * ctx.dailyAvailableMinutes * (daysLeft < 1 ? daysLeft : 1);
    const ratio = remainingMinutes / Math.max(availableMinutes, 1);
    capacityPressure = clamp(ratio);
    if (ratio >= 0.5) {
      reasons.push(
        `Needs ~${Math.round(ratio * 100)}% of your available study time before the deadline`
      );
    }
  }

  let raw = 0.4 * urgency + 0.25 * importance + 0.15 * effortPressure + 0.2 * capacityPressure;
  let score = Math.round(clamp(raw) * 100);

  if (overdue) {
    score = Math.max(score, 85);
  }
  if (task.status === 'in_progress') {
    score = Math.min(100, score + 5);
    reasons.push('Already in progress, so finishing it avoids context switching');
  }

  return { taskId: task.id, score, overdue, reasons };
}

export function rankTasks(tasks: PriorityTask[], ctx: PriorityContext): PriorityResult[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .map((t) => scoreTask(t, ctx))
    .sort((a, b) => b.score - a.score || a.taskId.localeCompare(b.taskId));
}
