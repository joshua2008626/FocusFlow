import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { progress, weekStart, type WeekData } from './lib/challenges';

export function Challenges() {
  const [d, setD] = useState<WeekData | null>(null);
  useEffect(() => { (async () => {
    const ws = weekStart(new Date()), iso = ws.toISOString(), day = iso.slice(0, 10);
    const [l, p, t, r] = await Promise.all([supabase!.from('study_logs').select('log_date').gte('log_date', day),
      supabase!.from('pomodoro_sessions').select('id', { count: 'exact', head: true }).eq('kind', 'focus').eq('status', 'completed').gte('started_at', iso),
      supabase!.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', iso),
      supabase!.from('revision_records').select('topic_id').gte('revised_at', iso)]);
    setD({ studyDays: new Set((l.data || []).map(x => x.log_date)).size, focusSessions: p.count ?? 0, tasksCompleted: t.count ?? 0, topicsRevised: new Set((r.data || []).map(x => x.topic_id)).size });
  })(); }, []);
  if (!d) return null;
  return (<div className="card"><h2>This week's challenges</h2>{progress(d).map(c => <div key={c.id} style={{ marginBottom: 8 }}>
    <div className="row"><span style={{ flex: 1 }}>{c.done ? '✅' : '⬜'} {c.title}</span><span className="mu">{c.value}/{c.target}</span></div>
    <div style={{ height: 6, background: 'var(--bd)', borderRadius: 4 }}><div style={{ width: `${c.value / c.target * 100}%`, height: 6, background: 'var(--ac2)', borderRadius: 4 }} /></div></div>)}
    <p className="mu">Resets every Monday. Rest days are fine; four study days is the goal, not seven.</p></div>);
}
