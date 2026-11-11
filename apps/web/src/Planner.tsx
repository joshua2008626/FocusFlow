import { useState } from 'react';
import { supabase } from './supabase';
import { api } from './api';

interface Block { task_id: string; day: string; minutes: number; reason: string }
interface Proposal { blocks: Block[]; unscheduled: { task_id: string; minutes_short: number; reason: string }[]; warnings: string[] }

export function Planner({ userId }: { userId: string }) {
  const [mins, setMins] = useState('120'); const [days, setDays] = useState('7'); const [p, setP] = useState<Proposal | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map()); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false);
  const propose = async () => {
    setErr(''); setSaved(false); setBusy(true);
    try {
      const { data, error } = await supabase!.from('tasks').select('id,title,importance,deadline,estimated_minutes,actual_minutes').neq('status', 'completed'); if (error) throw error;
      setTitles(new Map((data || []).map(t => [t.id, t.title])));
      const daily: Record<string, number> = {}; for (let i = 0; i < +days; i++) daily[new Date(Date.now() + i * 864e5).toISOString().slice(0, 10)] = +mins;
      const tasks = (data || []).map(t => ({ id: t.id, title: t.title, importance: t.importance, deadline: t.deadline, remaining_minutes: Math.max(0, (t.estimated_minutes ?? 30) - t.actual_minutes) })).filter(t => t.remaining_minutes > 0);
      setP(await api<Proposal>('/schedule/propose', { tasks, daily_minutes: daily }));
    } catch (e: any) { setErr(e.message || String(e)); } finally { setBusy(false); }
  };
  const approve = async () => {
    if (!p) return;
    const cursor = new Map<string, number>();
    const rows = p.blocks.map(b => { const start = new Date(`${b.day}T09:00:00`); const off = cursor.get(b.day) ?? 0; start.setMinutes(start.getMinutes() + off); cursor.set(b.day, off + b.minutes + 10);
      return { user_id: userId, task_id: b.task_id, starts_at: start.toISOString(), ends_at: new Date(+start + b.minutes * 60000).toISOString(), rationale: b.reason }; });
    const { error } = await supabase!.from('schedules').insert(rows); if (error) setErr(error.message); else setSaved(true);
  };
  const byDay = new Map<string, Block[]>(); p?.blocks.forEach(b => byDay.set(b.day, [...(byDay.get(b.day) || []), b]));
  return (<>
    <div className="card"><h2>Smart planner</h2><p className="mu">Builds a proposal from your tasks, deadlines and free time. Nothing is saved until you approve it.</p>
      <div className="row"><label>Study minutes/day <input type="number" value={mins} onChange={e => setMins(e.target.value)} style={{ width: 90 }} /></label>
        <label>Days <input type="number" min={1} max={30} value={days} onChange={e => setDays(e.target.value)} style={{ width: 70 }} /></label><button disabled={busy} onClick={propose}>{busy ? 'Planning…' : 'Generate plan'}</button></div></div>
    {err && <p className="bad">{err}</p>}
    {p && <>{p.warnings.map(w => <div key={w} className="card bad">⚠ {w}</div>)}
      {p.blocks.length === 0 && <div className="card mu">No tasks to schedule.</div>}
      {[...byDay].map(([d, bs]) => <div className="card" key={d}><b>{new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</b>
        {bs.map((b, i) => <div key={i} className="row"><span style={{ flex: 1 }}>{titles.get(b.task_id) ?? 'Task'}</span><span>{b.minutes} min</span><span className="mu">{b.reason}</span></div>)}</div>)}
      {p.blocks.length > 0 && <div className="row"><button disabled={saved} onClick={approve}>{saved ? 'Saved to your schedule' : 'Approve and save plan'}</button><button className="g" onClick={() => setP(null)}>Discard</button></div>}</>}
  </>);
}
