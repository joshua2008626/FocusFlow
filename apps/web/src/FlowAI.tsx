import { useState } from 'react';
import { supabase } from './supabase';
import { api } from './api';

export function FlowAI() {
  const [q, setQ] = useState(''); const [msgs, setMsgs] = useState<{ role: 'me' | 'ai'; text: string }[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const ask = async () => {
    if (!q.trim() || busy) return; const text = q.trim(); setQ(''); setErr(''); setBusy(true); setMsgs(m => [...m, { role: 'me', text }]);
    try {
      const [t, s] = await Promise.all([supabase!.from('tasks').select('title,priority,deadline,status').neq('status', 'completed').limit(20), supabase!.from('subjects').select('name').limit(20)]);
      const r = await api<{ reply: string }>('/ai/chat', { message: text, context: { pending_tasks: t.data, subjects: s.data } });
      setMsgs(m => [...m, { role: 'ai', text: r.reply }]);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (<div className="card"><h2>Flow AI</h2><p className="mu">Ask about priorities, revision or workload. Flow AI explains and advises. It never edits your schedule.</p>
    {msgs.map((m, i) => <p key={i} className={m.role === 'me' ? 'mu' : ''} style={{ whiteSpace: 'pre-wrap' }}><b>{m.role === 'me' ? 'You' : 'Flow AI'}:</b> {m.text}</p>)}
    {err && <p className="bad">{err}</p>}
    <div className="row"><input style={{ flex: 1 }} placeholder="What should I study next?" value={q} maxLength={2000} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} /><button disabled={busy} onClick={ask}>{busy ? '…' : 'Ask'}</button></div></div>);
}
