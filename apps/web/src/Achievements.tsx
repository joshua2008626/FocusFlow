import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Challenges } from './Challenges'; import { longestStreak, unlockedCodes, levelFromXp } from './lib/achievements';

export function Achievements({ userId }: { userId: string }) {
  const [state, setState] = useState<{ cat: any[]; have: Set<string>; xp: number; fresh: string[] } | null>(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    const [cat, mine, pomos, tasks, logs, prof] = await Promise.all([supabase!.from('achievements').select('*'), supabase!.from('user_achievements').select('achievement_id'),
      supabase!.from('pomodoro_sessions').select('id', { count: 'exact', head: true }).eq('kind', 'focus').eq('status', 'completed'),
      supabase!.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'completed'), supabase!.from('study_logs').select('log_date,subject_id'),
      supabase!.from('profiles').select('xp').eq('id', userId).maybeSingle()]);
    const e = cat.error || mine.error || pomos.error || tasks.error || logs.error; if (e) { setErr(e.message); return; }
    const l = logs.data || [];
    const codes = unlockedCodes({ completedFocusSessions: pomos.count ?? 0, completedTasks: tasks.count ?? 0, longestStreak: longestStreak(l.map(x => x.log_date)), distinctSubjectsStudied: new Set(l.map(x => x.subject_id).filter(Boolean)).size });
    const have = new Set<string>((mine.data || []).map((m: any) => m.achievement_id)); let xp = prof.data?.xp ?? 0; const fresh: string[] = [];
    for (const a of cat.data || []) if (codes.includes(a.code) && !have.has(a.id)) {
      const { error } = await supabase!.from('user_achievements').insert({ user_id: userId, achievement_id: a.id });
      if (!error) { have.add(a.id); xp += a.xp_reward; fresh.push(a.name); }
    }
    if (fresh.length) await supabase!.from('profiles').update({ xp }).eq('id', userId);
    setState({ cat: cat.data || [], have, xp, fresh });
  })(); }, [userId]);
  if (err) return <p className="bad">{err}</p>; if (!state) return <p className="mu">Loading…</p>;
  const lvl = levelFromXp(state.xp);
  return (<>
    <Challenges />
    <div className="card"><h2>Level {lvl} · {state.xp} XP</h2><p className="mu">XP rewards consistency and finishing what you plan. Rest, breaks and sleep never cost you progress.</p>
      {state.fresh.map(n => <p key={n} className="ok">🎉 Unlocked: {n}</p>)}</div>
    {state.cat.map(a => { const on = state.have.has(a.id); return (<div key={a.id} className="card" style={{ opacity: on ? 1 : 0.55 }}>
      <b>{on ? '🏅' : '🔒'} {a.name}</b> <span className="mu">+{a.xp_reward} XP</span><div className="mu">{a.description}</div></div>); })}
  </>);
}
