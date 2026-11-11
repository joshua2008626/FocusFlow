/** Spaced-repetition recommendations (mirrors apps/api/app/revision.py). */
export interface RevTopic { id: string; name: string; confidence: number; importance: number; last_revised_at: string | null; needs_revision: boolean; is_completed: boolean }
const INTERVAL = [1, 1, 3, 7, 14, 30];
export function topicsToRevise(topics: RevTopic[], now: Date, examDate?: Date | null) {
  const out: { id: string; name: string; score: number; reasons: string[] }[] = [];
  for (const t of topics) {
    if (!t.is_completed) continue;
    let days = INTERVAL[Math.min(5, Math.max(0, t.confidence))];
    const nearExam = examDate && examDate > now && (examDate.getTime() - now.getTime()) / 864e5 <= 14;
    if (nearExam) days /= 2;
    const last = t.last_revised_at ? new Date(t.last_revised_at).getTime() : now.getTime() - days * 864e5;
    const overdue = (now.getTime() - (last + days * 864e5)) / 864e5;
    if (overdue < 0 && !t.needs_revision) continue;
    const reasons = [];
    if (t.needs_revision) reasons.push('you flagged it as needing revision');
    if (overdue >= 0) reasons.push(`due ${Math.round(overdue)} day(s) ago at confidence ${t.confidence}/5`);
    if (nearExam) reasons.push('exam within 14 days');
    out.push({ id: t.id, name: t.name, score: Math.max(overdue, 0) + t.importance * 0.5 + (5 - t.confidence) * 0.5 + (t.needs_revision ? 3 : 0), reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}
