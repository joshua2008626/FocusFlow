import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { rankTasks, type PriorityTask } from './lib/priority';

interface Row { id: string; title: string; priority: 'high' | 'medium' | 'low'; importance: number; status: 'not_started' | 'in_progress' | 'completed';
  deadline: string | null; estimated_minutes: number | null; actual_minutes: number }

export function Tasks({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Row[]>([]); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(''); const [due, setDue] = useState(''); const [est, setEst] = useState('30');
  const [pri, setPri] = useState<Row['priority']>('medium'); const [q, setQ] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await supabase!.from('tasks').select('*').order('deadline', { nullsFirst: false });
    if (error) setErr(error.message); else setRows(data as Row[]); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!title.trim()) return;
    const { error } = await supabase!.from('tasks').insert({ user_id: userId, title: title.trim(), priority: pri,
      importance: pri === 'high' ? 5 : pri === 'medium' ? 3 : 1, deadline: due ? new Date(due).toISOString() : null, estimated_minutes: Number(est) || null });
    if (error) setErr(error.message); else { setTitle(''); setDue(''); load(); }
  };
  const setStatus = async (r: Row, status: Row['status']) => {
    const { error } = await supabase!.from('tasks').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', r.id);
    if (error) setErr(error.message); else load();
  };
  const del = async (id: string) => { const { error } = await supabase!.from('tasks').delete().eq('id', id); if (error) setErr(error.message); else load(); };

  const pt: PriorityTask[] = rows.map(r => ({ id: r.id, title: r.title, deadline: r.deadline ? new Date(r.deadline) : null, importance: r.importance as 1,
    priority: r.priority, estimatedMinutes: r.estimated_minutes, actualMinutes: r.actual_minutes, status: r.status }));
  const ranked = rankTasks(pt, { now: new Date(), dailyAvailableMinutes: 180 });
  const byId = new Map(rows.map(r => [r.id, r])); const done = rows.filter(r => r.status === 'completed');
  const shown = ranked.filter(x => byId.get(x.taskId)!.title.toLowerCase().includes(q.toLowerCase()));

  return (<>
    <div className="card"><h2>Add task</h2><div className="row">
      <input placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} />
      <input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} />
      <input type="number" min={5} style={{ width: 90 }} value={est} onChange={e => setEst(e.target.value)} title="Estimated minutes" />
      <select value={pri} onChange={e => setPri(e.target.value as Row['priority'])}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
      <button onClick={add}>Add</button></div></div>
    {err && <p className="bad">{err}</p>}
    <div className="row" style={{ marginBottom: 12 }}><input placeholder="Search tasks" value={q} onChange={e => setQ(e.target.value)} /></div>
    {loading ? <p className="mu">Loading…</p> : shown.length === 0 && <div className="card mu">No pending tasks yet. Add your first task above.</div>}
    {shown.map(x => { const r = byId.get(x.taskId)!; return (
      <div className="card" key={r.id}><div className="row"><b style={{ flex: 1 }}>{r.title}</b>
        <span className={x.overdue ? 'bad' : 'mu'}>Priority {x.score}</span>
        <select value={r.status} onChange={e => setStatus(r, e.target.value as Row['status'])}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
        <button className="g" onClick={() => del(r.id)}>Delete</button></div>
        <div className="mu">Why: {x.reasons.join(' · ')}</div></div>); })}
    {done.length > 0 && <p className="mu ok">{done.length} completed</p>}
  </>);
}
