import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from './supabase';
import { lastNDays, minutesBySubject, type Log } from './lib/stats';

const COLORS = ['#7c5cff', '#22d3ee', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#60a5fa'];

export function Analytics() {
  const [range, setRange] = useState('30'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [data, setData] = useState<{ logs: Log[]; subs: any[]; pomos: any[]; tasks: any[] } | null>(null); const [err, setErr] = useState('');
  const end = range === 'custom' && to ? new Date(to) : new Date();
  const start = range === 'custom' ? (from ? new Date(from) : new Date(Date.now() - 30 * 864e5)) : new Date(+end - (+range - 1) * 864e5);
  const days = Math.max(1, Math.round((+end - +start) / 864e5) + 1), k = (d: Date) => d.toISOString().slice(0, 10);
  useEffect(() => { (async () => {
    const [l, s, p, t] = await Promise.all([supabase!.from('study_logs').select('log_date,minutes,subject_id').gte('log_date', k(start)).lte('log_date', k(end)),
      supabase!.from('subjects').select('id,name'), supabase!.from('pomodoro_sessions').select('status,kind,started_at').eq('kind', 'focus').gte('started_at', start.toISOString()),
      supabase!.from('tasks').select('status,completed_at,estimated_minutes,actual_minutes')]);
    const e = l.error || s.error || p.error || t.error; if (e) setErr(e.message);
    setData({ logs: (l.data as Log[]) || [], subs: s.data || [], pomos: p.data || [], tasks: t.data || [] });
  })(); }, [range, from, to]);
  if (!data) return <p className="mu">Loading…</p>;

  const daily = lastNDays(data.logs, Math.min(days, 120), end), total = daily.reduce((s, d) => s + d.minutes, 0), activeDays = daily.filter(d => d.minutes > 0).length;
  const names = new Map(data.subs.map(s => [s.id, s.name])); const pie = [...minutesBySubject(data.logs)].map(([id, v]) => ({ name: names.get(id) ?? 'No subject', value: v }));
  const donePomos = data.pomos.filter(p => p.status === 'completed').length, pomoRate = data.pomos.length ? Math.round(donePomos / data.pomos.length * 100) : null;
  const doneTasks = data.tasks.filter(t => t.status === 'completed'), rate = data.tasks.length ? Math.round(doneTasks.length / data.tasks.length * 100) : null;
  const withEst = doneTasks.filter(t => t.estimated_minutes), planned = withEst.reduce((s, t) => s + t.estimated_minutes, 0), actual = withEst.reduce((s, t) => s + t.actual_minutes, 0);
  const byDow = [0, 0, 0, 0, 0, 0, 0]; daily.forEach(d => byDow[new Date(d.day).getUTCDay()] += d.minutes);
  const best = byDow.some(v => v) ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][byDow.indexOf(Math.max(...byDow))] : null;
  const max = Math.max(1, ...daily.map(d => d.minutes));

  return (<>
    <div className="row" style={{ marginBottom: 12 }}>{[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['custom', 'Custom']].map(([v, l]) => <button key={v} className={range === v ? 'on' : 'g'} onClick={() => setRange(v)}>{l}</button>)}
      {range === 'custom' && <><input type="date" value={from} onChange={e => setFrom(e.target.value)} /><input type="date" value={to} onChange={e => setTo(e.target.value)} /></>}</div>
    {err && <p className="bad">{err}</p>}
    {total === 0 && <div className="card mu">No study time in this range yet. Complete a focus session to start building your analytics.</div>}
    <div className="row">{[['Total', `${Math.round(total / 6) / 10} h`], ['Active days', `${activeDays}/${days}`], ['Avg per active day', activeDays ? `${Math.round(total / activeDays)} min` : '–'], ['Pomodoro completion', pomoRate == null ? '–' : `${pomoRate}%`], ['Task completion', rate == null ? '–' : `${rate}%`], ['Best day', best ?? '–']].map(([a, b]) =>
      <div key={a} className="card" style={{ flex: '1 1 140px' }}><div className="mu">{a}</div><b style={{ fontSize: '1.4rem' }}>{b}</b></div>)}</div>
    <div className="card"><h3>Study time per day (min)</h3><div style={{ height: 220 }}><ResponsiveContainer><BarChart data={daily.map(d => ({ ...d, day: d.day.slice(5) }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" /><XAxis dataKey="day" stroke="var(--mu)" interval="preserveStartEnd" /><YAxis stroke="var(--mu)" /><Tooltip /><Bar dataKey="minutes" fill="#7c5cff" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
    <div className="row" style={{ alignItems: 'stretch' }}>
      <div className="card" style={{ flex: '1 1 300px' }}><h3>By subject</h3>{pie.length === 0 ? <p className="mu">No data.</p> : <div style={{ height: 220 }}><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>}</div>
      <div className="card" style={{ flex: '1 1 300px' }}><h3>Planned vs actual</h3>{withEst.length === 0 ? <p className="mu">Complete tasks with time estimates to compare.</p> : <p>Planned <b>{planned} min</b> · Actual <b>{actual} min</b><br /><span className="mu">{actual > planned ? 'You tend to underestimate. Add a buffer.' : 'Your estimates are holding up.'}</span></p>}</div></div>
    <div className="card"><h3>Consistency</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,14px)', gap: 3 }}>{daily.map(d => <div key={d.day} title={`${d.day}: ${d.minutes} min`} style={{ width: 14, height: 14, borderRadius: 3, background: d.minutes ? `rgba(124,92,255,${0.25 + 0.75 * d.minutes / max})` : 'var(--bd)' }} />)}</div></div>
  </>);
}
