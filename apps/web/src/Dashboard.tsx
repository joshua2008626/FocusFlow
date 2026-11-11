import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { currentStreak, lastNDays, type Log } from './lib/stats';
import { rankTasks, type PriorityTask } from './lib/priority';

export function Dashboard({ user, name, go }: { user: string; name: string; go: (t: any) => void }) {
  const [d, setD] = useState<{ logs: Log[]; tasks: any[]; goal: number; sched: any[]; subs: any[]; tops: any[] } | null>(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); const dayEnd = new Date(+dayStart + 864e5);
    const [l, t, p, sc, sb, tp] = await Promise.all([supabase!.from('study_logs').select('log_date,minutes,subject_id').gte('log_date', since),
      supabase!.from('tasks').select('*'), supabase!.from('profiles').select('daily_goal_minutes').eq('id', user).maybeSingle(),
      supabase!.from('schedules').select('id,starts_at,ends_at,block_type,status,task_id').gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString()).order('starts_at'),
      supabase!.from('subjects').select('id,name,color'), supabase!.from('topics').select('subject_id,is_completed')]);
    const e = l.error || t.error || p.error || sc.error || sb.error || tp.error; if (e) setErr(e.message);
    setD({ logs: (l.data as Log[]) || [], tasks: t.data || [], goal: p.data?.daily_goal_minutes ?? 120, sched: sc.data || [], subs: sb.data || [], tops: tp.data || [] });
  })(); }, [user]);
  if (!d) return <p className="mu">Loading…</p>;
  const today = new Date(), todayKey = today.toISOString().slice(0, 10);
  const todayMin = d.logs.filter(l => l.log_date === todayKey).reduce((s, l) => s + l.minutes, 0);
  const pending = d.tasks.filter(t => t.status !== 'completed'), done = d.tasks.length - pending.length;
  const upcoming = pending.filter(t => t.deadline).sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline)).slice(0, 5);
  const week = lastNDays(d.logs, 7, today), max = Math.max(30, ...week.map(w => w.minutes));
  const titleOf = new Map(d.tasks.map(t => [t.id, t.title]));
  const pt: PriorityTask[] = d.tasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline ? new Date(t.deadline) : null, importance: (t.importance ?? 3) as 1, priority: t.priority, estimatedMinutes: t.estimated_minutes, actualMinutes: t.actual_minutes ?? 0, status: t.status }));
  const next = rankTasks(pt, { now: today, dailyAvailableMinutes: d.goal }).slice(0, 3);
  const pct = Math.min(100, Math.round(todayMin / d.goal * 100));
  return (<>
    <h2>Hello{name ? `, ${name}` : ''} 👋</h2><p className="mu">{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    {err && <p className="bad">{err}</p>}
    <div className="row" style={{ marginBottom: 12 }}><button onClick={() => go('tasks')}>Add Task</button><button onClick={() => go('timer')}>Start Focus Session</button><button className="g" onClick={() => go('subjects')}>Add Subject</button></div>
    <div className="row">{[['Studied today', `${todayMin} min`], ['Daily goal', `${pct}%`], ['Streak', `${currentStreak(d.logs, today)} days`], ['Completed', String(done)], ['Pending', String(pending.length)]].map(([k, v]) =>
      <div className="card" key={k} style={{ flex: '1 1 130px' }}><div className="mu">{k}</div><b style={{ fontSize: '1.5rem' }}>{v}</b></div>)}</div>
    <div className="card"><h3>This week</h3>{d.logs.length === 0 ? <p className="mu">No study time logged yet. Finish a focus session and it will show up here.</p> :
      <div className="row" style={{ alignItems: 'flex-end', height: 120 }}>{week.map(w => <div key={w.day} style={{ flex: 1, textAlign: 'center' }}>
        <div title={`${w.minutes} min`} style={{ height: Math.max(3, w.minutes / max * 90), background: 'var(--ac)', borderRadius: 6 }} /><span className="mu">{w.day.slice(8)}</span></div>)}</div>}</div>
    <div className="card"><h3>Upcoming deadlines</h3>{upcoming.length === 0 ? <p className="mu">Nothing due. Add a deadline to a task to see it here.</p> :
      upcoming.map(t => <div key={t.id} className="row"><span style={{ flex: 1 }}>{t.title}</span><span className={new Date(t.deadline) < today ? 'bad' : 'mu'}>{new Date(t.deadline).toLocaleString()}</span></div>)}</div>
    <div className="card"><h3>Recommended next</h3>{next.length === 0 ? <p className="mu">Add tasks and Flow will rank what to do first, with reasons.</p> :
      next.map(r => <div key={r.taskId} style={{ marginBottom: 8 }}><div className="row"><b style={{ flex: 1 }}>{titleOf.get(r.taskId)}</b><span className={r.overdue ? 'bad' : 'mu'}>score {r.score}</span></div><div className="mu">{r.reasons.join(' · ')}</div></div>)}</div>
    <div className="card"><h3>Today's schedule</h3>{d.sched.length === 0 ? <p className="mu">Nothing planned for today. Generate and approve a plan in the Planner.</p> :
      d.sched.map(b => <div key={b.id} className="row"><span className="mu">{new Date(b.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span style={{ flex: 1 }}>{titleOf.get(b.task_id) ?? `${b.block_type} block`}</span><span className="mu">{Math.round((+new Date(b.ends_at) - +new Date(b.starts_at)) / 60000)} min · {b.status}</span></div>)}</div>
    <div className="card"><h3>Subject progress</h3>{d.subs.length === 0 ? <p className="mu">Add a subject to track topic progress.</p> : d.subs.map(sb => { const ts = d.tops.filter(t => t.subject_id === sb.id), c = ts.filter(t => t.is_completed).length, p = ts.length ? Math.round(c / ts.length * 100) : 0;
      return <div key={sb.id} style={{ marginBottom: 8 }}><div className="row"><span style={{ flex: 1 }}>{sb.name}</span><span className="mu">{c}/{ts.length} topics</span></div><div style={{ height: 6, background: 'var(--bd)', borderRadius: 4 }}><div style={{ width: `${p}%`, height: 6, background: sb.color, borderRadius: 4 }} /></div></div>; })}</div>
  </>);
}
