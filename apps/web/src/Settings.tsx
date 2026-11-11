import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export function Settings({ userId }: { userId: string }) {
  const [p, setP] = useState<any>(null); const [msg, setMsg] = useState('');
  useEffect(() => { supabase!.from('profiles').select('*').eq('id', userId).maybeSingle().then(r => r.error ? setMsg(r.error.message) : setP(r.data)); }, [userId]);
  if (!p) return <p className="mu">{msg || 'Loading…'}</p>;
  const f = (k: string, label: string, num = true) => <label>{label}<br /><input value={p[k] ?? ''} type={num ? 'number' : 'text'} onChange={e => setP({ ...p, [k]: num ? Number(e.target.value) : e.target.value })} /></label>;
  const save = async () => { const { error } = await supabase!.from('profiles').update({ full_name: p.full_name, daily_goal_minutes: p.daily_goal_minutes, focus_minutes: p.focus_minutes, short_break_minutes: p.short_break_minutes, long_break_minutes: p.long_break_minutes, sessions_before_long_break: p.sessions_before_long_break }).eq('id', userId); setMsg(error ? error.message : 'Saved.'); };
  return (<div className="card"><h2>Profile and timer</h2><div className="row">{f('full_name', 'Name', false)}{f('daily_goal_minutes', 'Daily goal (min)')}{f('focus_minutes', 'Focus (min)')}{f('short_break_minutes', 'Short break')}{f('long_break_minutes', 'Long break')}{f('sessions_before_long_break', 'Sessions before long break')}</div>
    <p className="mu">Breaks are part of the plan. Keep them, and your streak stays healthy.</p><button onClick={save}>Save</button> <span className={msg === 'Saved.' ? 'ok' : 'bad'}>{msg}</span></div>);
}
