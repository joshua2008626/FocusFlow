import { useEffect, useState } from 'react';
import { rankTasks, type PriorityTask } from './lib/priority';

const h = (n: number) => new Date(Date.now() + n * 3_600_000);
const SAMPLE: PriorityTask[] = [
  { id: 'Physics problem set', title: 'Physics problem set', deadline: h(20), importance: 5, priority: 'high', estimatedMinutes: 120, actualMinutes: 30, status: 'in_progress' },
  { id: 'History essay outline', title: 'History essay outline', deadline: h(90), importance: 3, priority: 'medium', estimatedMinutes: 60, actualMinutes: 0, status: 'not_started' },
  { id: 'Read chapter 4', title: 'Read chapter 4', deadline: null, importance: 2, priority: 'low', estimatedMinutes: 45, actualMinutes: 0, status: 'not_started' },
];
const WEEK = [35, 80, 50, 0, 95, 60, 20];

/** Interactive demos with clearly labelled sample data. Not the real timer (which is timestamp-based). */
export function Previews() {
  const [left, setLeft] = useState(25 * 60), [run, setRun] = useState(false);
  useEffect(() => { if (!run) return; const i = setInterval(() => setLeft(l => (l > 0 ? l - 1 : 0)), 1000); return () => clearInterval(i); }, [run]);
  const ranked = rankTasks(SAMPLE, { now: new Date(), dailyAvailableMinutes: 180 });
  const pct = 1 - left / 1500;
  return (<section style={{ maxWidth: 960, margin: '0 auto', padding: '40px 16px' }}>
    <h2>Try it <span className="mu">(sample data, nothing is saved)</span></h2>
    <div className="flex flex-wrap gap-3">
      <div className="card text-center" style={{ flex: '1 1 260px' }}><b>Pomodoro</b>
        <div className="ring" style={{ background: `conic-gradient(var(--ac) ${pct * 360}deg, var(--bd) 0)`, width: 140, height: 140, margin: '12px auto' }}>
          <div className="card" style={{ width: 112, height: 112, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: 0, fontSize: '1.6rem' }}>{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div></div>
        <button onClick={() => setRun(!run)}>{run ? 'Pause' : 'Start'}</button> <button className="g" onClick={() => { setRun(false); setLeft(1500); }}>Reset</button></div>
      <div className="card" style={{ flex: '2 1 320px' }}><b>Smart planner: what to do next</b>
        {ranked.map(r => <div key={r.taskId} className="mt-2"><div className="row"><span style={{ flex: 1 }}>{r.taskId}</span><b>{r.score}</b></div><div className="mu">{r.reasons.join(' · ')}</div></div>)}</div>
      <div className="card" style={{ flex: '1 1 260px' }}><b>Analytics preview</b>
        <div className="flex items-end gap-1" style={{ height: 110, marginTop: 10 }}>{WEEK.map((v, i) => <div key={i} className="flex-1 rounded" title={`${v} min`} style={{ height: Math.max(4, v), background: 'var(--ac)' }} />)}</div>
        <div className="mu">Mon to Sun, minutes (sample)</div></div>
    </div></section>);
}
