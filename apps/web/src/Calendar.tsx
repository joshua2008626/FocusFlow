import { useCallback, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGrid from '@fullcalendar/daygrid';
import timeGrid from '@fullcalendar/timegrid';
import interaction from '@fullcalendar/interaction';
import { supabase } from './supabase';

const COLORS: Record<string, string> = { study: '#7c5cff', assignment: '#22d3ee', exam: '#f87171', deadline: '#f59e0b', revision: '#34d399', custom: '#60a5fa' };
const TABLE: Record<string, [string, string]> = { ev: ['calendar_events', 'starts_at'], sch: ['schedules', 'starts_at'], task: ['tasks', 'deadline'], exam: ['exams', 'exam_date'] };

export function CalendarView({ userId }: { userId: string }) {
  const [events, setEvents] = useState<any[]>([]); const [err, setErr] = useState('');
  const [f, setF] = useState({ title: '', at: '', type: 'study', mins: 'none' });
  const load = useCallback(async () => {
    const [c, t, e, s] = await Promise.all([supabase!.from('calendar_events').select('*'), supabase!.from('tasks').select('id,title,deadline').neq('status', 'completed').not('deadline', 'is', null),
      supabase!.from('exams').select('id,title,exam_date'), supabase!.from('schedules').select('id,starts_at,ends_at,block_type,status').neq('status', 'rescheduled')]);
    const er = c.error || t.error || e.error || s.error; if (er) setErr(er.message);
    setEvents([
      ...(c.data || []).map(x => ({ id: `ev:${x.id}`, title: x.title, start: x.starts_at, end: x.ends_at ?? undefined, color: COLORS[x.event_type] })),
      ...(t.data || []).map(x => ({ id: `task:${x.id}`, title: `Due: ${x.title}`, start: x.deadline, color: COLORS.deadline })),
      ...(e.data || []).map(x => ({ id: `exam:${x.id}`, title: x.title, start: x.exam_date, color: COLORS.exam })),
      ...(s.data || []).map(x => ({ id: `sch:${x.id}`, title: `Study block (${x.block_type})`, start: x.starts_at, end: x.ends_at, color: COLORS.study })),
    ]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!f.title.trim() || !f.at) return; const start = new Date(f.at);
    const { data, error } = await supabase!.from('calendar_events').insert({ user_id: userId, title: f.title.trim(), event_type: f.type, starts_at: start.toISOString() }).select('id').single();
    if (error) { setErr(error.message); return; }
    if (f.mins !== 'none') { const { error: re } = await supabase!.from('reminders').insert({ user_id: userId, event_id: data.id, remind_at: new Date(+start - +f.mins * 60000).toISOString() }); if (re) setErr(re.message); }
    setF({ ...f, title: '' }); load();
  };
  const moved = async (info: any) => {
    const [kind, id] = info.event.id.split(':'); const [table, col] = TABLE[kind];
    const upd: any = { [col]: info.event.start.toISOString() }; if (info.event.end && (kind === 'ev' || kind === 'sch')) upd.ends_at = info.event.end.toISOString();
    const { error } = await supabase!.from(table).update(upd).eq('id', id); if (error) { setErr(error.message); info.revert(); }
  };
  const clicked = async (info: any) => {
    const [kind, id] = info.event.id.split(':');
    if (kind === 'ev' && confirm(`Delete "${info.event.title}"?`)) { const { error } = await supabase!.from('calendar_events').delete().eq('id', id); if (error) setErr(error.message); else load(); }
  };
  return (<>
    <div className="card"><h2>Add event</h2><div className="row"><input placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
      <input type="datetime-local" value={f.at} onChange={e => setF({ ...f, at: e.target.value })} />
      <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Object.keys(COLORS).map(k => <option key={k}>{k}</option>)}</select>
      <select value={f.mins} onChange={e => setF({ ...f, mins: e.target.value })}><option value="none">No reminder</option><option value="10">10 min before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select>
      <button onClick={add}>Add</button></div><p className="mu">Drag any item to reschedule it. Click one of your events to delete it.</p></div>
    {err && <p className="bad">{err}</p>}
    <div className="card"><FullCalendar plugins={[dayGrid, timeGrid, interaction]} initialView="dayGridMonth" height="auto" editable events={events} eventDrop={moved} eventResize={moved} eventClick={clicked}
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} /></div></>);
}

/** Mounted once while signed in. Fires due reminders as browser notifications plus an in-app banner. */
export function RemindersWatcher() {
  const [due, setDue] = useState<string[]>([]);
  useEffect(() => {
    const tick = async () => {
      const { data } = await supabase!.from('reminders').select('id,event_id,calendar_events(title,starts_at)').lte('remind_at', new Date().toISOString()).is('sent_at', null).eq('dismissed', false);
      for (const r of (data as any[]) || []) {
        const ev = Array.isArray(r.calendar_events) ? r.calendar_events[0] : r.calendar_events; const msg = ev ? `${ev.title} at ${new Date(ev.starts_at).toLocaleString()}` : 'Upcoming event';
        if ('Notification' in window && Notification.permission === 'granted') new Notification('FocusFlow reminder', { body: msg });
        setDue(d => [...d, msg]); await supabase!.from('reminders').update({ sent_at: new Date().toISOString() }).eq('id', r.id);
      }
    };
    tick(); const i = setInterval(tick, 30000); return () => clearInterval(i);
  }, []);
  return <>{due.map((m, i) => <div key={i} className="card ok">⏰ {m} <button className="g" onClick={() => setDue(d => d.filter((_, j) => j !== i))}>Dismiss</button></div>)}</>;
}
