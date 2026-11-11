import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { reorder } from './lib/order';

type St = 'not_started' | 'in_progress' | 'completed';
const COLS: [St, string][] = [['not_started', 'Not started'], ['in_progress', 'In progress'], ['completed', 'Completed']];
interface T { id: string; title: string; status: St; priority: string; deadline: string | null; sort_order: number }
interface Sub { id: string; task_id: string; title: string; is_done: boolean }

export function Board({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<T[]>([]); const [subs, setSubs] = useState<Sub[]>([]); const [open, setOpen] = useState<string | null>(null); const [txt, setTxt] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const [t, s] = await Promise.all([supabase!.from('tasks').select('id,title,status,priority,deadline,sort_order').order('sort_order').order('created_at'), supabase!.from('subtasks').select('*').order('sort_order')]);
    const e = t.error || s.error; if (e) setErr(e.message); setTasks((t.data as T[]) || []); setSubs((s.data as Sub[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const move = async (id: string, status: St) => { const { error } = await supabase!.from('tasks').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', id); if (error) setErr(error.message); else load(); };
  /** Drop `id` into column `st`, before card `beforeId` (or at the end). Persists status and sort_order for the whole column. */
  const drop = async (id: string, st: St, beforeId: string | null) => {
    const col = tasks.filter(t => t.status === st).map(t => t.id); const ids = reorder(col, id, beforeId); const moved = tasks.find(t => t.id === id); if (!moved) return;
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, status: st } : t)));
    const res = await Promise.all(ids.map((tid, i) => supabase!.from('tasks').update(tid === id && moved.status !== st ? { status: st, sort_order: i, completed_at: st === 'completed' ? new Date().toISOString() : null } : { sort_order: i }).eq('id', tid)));
    const bad = res.find(r => r.error); if (bad?.error) setErr(bad.error.message); load();
  };
  const addSub = async (taskId: string) => { if (!txt.trim()) return; const { error } = await supabase!.from('subtasks').insert({ user_id: userId, task_id: taskId, title: txt.trim() }); if (error) setErr(error.message); else { setTxt(''); load(); } };
  const toggle = async (s: Sub) => { const { error } = await supabase!.from('subtasks').update({ is_done: !s.is_done }).eq('id', s.id); if (error) setErr(error.message); else load(); };
  return (<>{err && <p className="bad">{err}</p>}
    <div className="row" style={{ alignItems: 'stretch' }}>{COLS.map(([st, label]) => (
      <div key={st} className="card" style={{ flex: '1 1 260px', minHeight: 200 }} onDragOver={e => e.preventDefault()} onDrop={e => { const id = e.dataTransfer.getData('text/plain'); if (id) drop(id, st, null); }}>
        <h3>{label} <span className="mu">{tasks.filter(t => t.status === st).length}</span></h3>
        {tasks.filter(t => t.status === st).map(t => { const ss = subs.filter(s => s.task_id === t.id); return (
          <div key={t.id} className="card" draggable onDragStart={e => e.dataTransfer.setData('text/plain', t.id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.stopPropagation(); const id = e.dataTransfer.getData('text/plain'); if (id) drop(id, st, t.id); }} style={{ cursor: 'grab' }}>
            <b>{t.title}</b><div className="mu">{t.priority}{t.deadline && ` · due ${new Date(t.deadline).toLocaleDateString()}`}{ss.length > 0 && ` · ${ss.filter(s => s.is_done).length}/${ss.length} subtasks`}</div>
            <div className="row">{COLS.filter(([c]) => c !== st).map(([c, l]) => <button key={c} className="g" onClick={() => move(t.id, c)}>→ {l}</button>)}<button className="g" onClick={() => setOpen(open === t.id ? null : t.id)}>Subtasks</button></div>
            {open === t.id && <div>{ss.map(s => <label key={s.id} style={{ display: 'block' }}><input type="checkbox" checked={s.is_done} onChange={() => toggle(s)} /> {s.title}</label>)}
              <div className="row"><input placeholder="New subtask" value={txt} onChange={e => setTxt(e.target.value)} /><button className="g" onClick={() => addSub(t.id)}>Add</button></div></div>}
          </div>); })}</div>))}</div>
    {tasks.length === 0 && <p className="mu">No tasks yet. Create one in the Tasks tab.</p>}</>);
}
