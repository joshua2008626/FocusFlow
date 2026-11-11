import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import * as T from './lib/timer';

const KEY = 'ff.timer.v1';
const load = (): T.TimerState => { try { return JSON.parse(localStorage.getItem(KEY) || '') as T.TimerState; } catch { return T.initialState(); } };

export function Timer({ userId }: { userId: string }) {
  const [s, setS] = useState<T.TimerState>(load); const [now, setNow] = useState(Date.now());
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([]); const [note, setNote] = useState(''); const [hist, setHist] = useState<any[]>([]);
  const [settings, setSettings] = useState(T.DEFAULT_SETTINGS); const sref = useRef(settings); sref.current = settings; const ref = useRef(s); ref.current = s;

  const save = async (rec: T.SessionRecord | null) => {
    if (!rec || rec.kind !== 'focus') return;
    const { data, error } = await supabase!.from('pomodoro_sessions').insert({ user_id: userId, task_id: rec.taskId, kind: rec.kind,
      planned_seconds: rec.plannedSeconds, focused_seconds: rec.focusedSeconds, status: rec.status, started_at: new Date(rec.startedAt).toISOString(),
      ended_at: new Date(rec.endedAt).toISOString(), notes: note || null }).select('id').single();
    if (!error && data) await supabase!.from('study_logs').insert({ user_id: userId, task_id: rec.taskId, session_id: data.id,
      log_date: new Date(rec.startedAt).toISOString().slice(0, 10), minutes: Math.max(1, Math.round(rec.focusedSeconds / 60)) });
    if (rec.status === 'completed' && 'Notification' in window && Notification.permission === 'granted') new Notification('FocusFlow', { body: 'Session complete. Take a break!' });
    refreshHist();
  };
  const apply = (r: { state: T.TimerState; record: T.SessionRecord | null }) => { setS(r.state); save(r.record); };
  const refreshHist = async () => { const { data } = await supabase!.from('pomodoro_sessions').select('*').order('started_at', { ascending: false }).limit(8); setHist(data || []); };

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);
  useEffect(() => { supabase!.from('tasks').select('id,title').neq('status', 'completed').then(r => setTasks(r.data || [])); refreshHist();
    supabase!.from('profiles').select('focus_minutes,short_break_minutes,long_break_minutes,sessions_before_long_break').eq('id', userId).maybeSingle().then(r => { const p = r.data; if (!p) return; const ns = { focusMinutes: p.focus_minutes, shortBreakMinutes: p.short_break_minutes, longBreakMinutes: p.long_break_minutes, sessionsBeforeLongBreak: p.sessions_before_long_break }; setSettings(ns); setS(c => c.run === 'idle' && c.phase === 'focus' ? { ...c, plannedMs: ns.focusMinutes * 60000 } : c); });
    const check = () => { setNow(Date.now()); const r = T.reconcile(ref.current, Date.now(), sref.current); if (r.record || r.state !== ref.current) apply(r); };
    check(); const i = setInterval(check, 500); document.addEventListener('visibilitychange', check);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', check); }; }, []);

  const left = Math.ceil(T.remainingMs(s, now) / 1000), pct = 1 - left / (s.plannedMs / 1000);
  const label = s.phase === 'focus' ? 'Focus' : s.phase === 'short_break' ? 'Short break' : 'Long break';
  return (<div className="card" style={{ textAlign: 'center' }}>
    <h2>{label} · {s.completedFocusSessions} sessions done</h2>
    <div className="ring" style={{ background: `conic-gradient(var(--ac) ${pct * 360}deg, var(--bd) 0)` }}>
      <div className="card tm" style={{ width: 190, height: 190, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: 0 }}>
        {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div></div>
    <div className="row" style={{ justifyContent: 'center', margin: '16px 0' }}>
      <select value={s.taskId ?? ''} disabled={s.run !== 'idle'} onChange={e => setS({ ...s, taskId: e.target.value || null })}><option value="">No task</option>{tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
      {s.run === 'running' ? <button onClick={() => setS(T.pause(s, Date.now()))}>Pause</button>
        : <button onClick={() => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); setS(T.start(s, Date.now())); }}>{s.run === 'paused' ? 'Resume' : 'Start'}</button>}
      <button className="g" onClick={() => apply(T.finish(s, Date.now(), settings, 'interrupted'))}>{s.phase === 'focus' ? 'Reset' : 'Skip break'}</button></div>
    <input placeholder="Quick note for this session" value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%', maxWidth: 420 }} />
    <h3>Recent sessions</h3>{hist.length === 0 && <p className="mu">No sessions yet.</p>}
    {hist.map(h => <div key={h.id} className="mu">{new Date(h.started_at).toLocaleString()} · {Math.round(h.focused_seconds / 60)} min · {h.status}</div>)}
  </div>);
}
