import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { topicsToRevise, type RevTopic } from './lib/revision';

interface Subj { id: string; name: string; code: string | null; color: string }
interface Topic extends RevTopic { subject_id: string; chapter: string | null; revision_count: number }

export function Subjects({ userId }: { userId: string }) {
  const [subs, setSubs] = useState<Subj[]>([]); const [tops, setTops] = useState<Topic[]>([]); const [exams, setExams] = useState<any[]>([]); const [err, setErr] = useState('');
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [newTopic, setNewTopic] = useState<Record<string, string>>({});
  const [examD, setExamD] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const [s, t, e] = await Promise.all([supabase!.from('subjects').select('*').order('created_at'), supabase!.from('topics').select('*').order('created_at'), supabase!.from('exams').select('*').order('exam_date')]);
    const er = s.error || t.error || e.error; if (er) setErr(er.message); setSubs(s.data || []); setTops((t.data as Topic[]) || []); setExams(e.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => { const { error } = await p; if (error) setErr(error.message); else { setErr(''); load(); } };
  const addSub = () => name.trim() && run(supabase!.from('subjects').insert({ user_id: userId, name: name.trim(), code: code.trim() || null }).then(r => { setName(''); setCode(''); return r; }));
  const addTopic = (s: Subj) => newTopic[s.id]?.trim() && run(supabase!.from('topics').insert({ user_id: userId, subject_id: s.id, name: newTopic[s.id].trim() }).then(r => { setNewTopic({ ...newTopic, [s.id]: '' }); return r; }));
  const patch = (t: Topic, v: object) => run(supabase!.from('topics').update(v).eq('id', t.id));
  const revised = async (t: Topic, conf: number) => {
    await run(supabase!.from('revision_records').insert({ user_id: userId, topic_id: t.id, confidence_before: t.confidence, confidence_after: conf }));
    await patch(t, { confidence: conf, needs_revision: false, last_revised_at: new Date().toISOString(), revision_count: (t.revision_count ?? 0) + 1 });
  };
  const addExam = (s: Subj) => examD[s.id] && run(supabase!.from('exams').insert({ user_id: userId, subject_id: s.id, title: `${s.name} exam`, exam_date: new Date(examD[s.id]).toISOString() }));
  const now = new Date();
  const nextExam = (id: string) => exams.filter(e => e.subject_id === id && new Date(e.exam_date) > now).map(e => new Date(e.exam_date))[0] ?? null;
  const revise = subs.flatMap(s => topicsToRevise(tops.filter(t => t.subject_id === s.id), now, nextExam(s.id)).map(r => ({ ...r, subject: s.name, topic: tops.find(t => t.id === r.id)! })));

  return (<>
    <div className="card"><h2>Add subject</h2><div className="row"><input placeholder="Subject name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Code (optional)" value={code} onChange={e => setCode(e.target.value)} /><button onClick={addSub}>Add</button></div></div>
    {err && <p className="bad">{err}</p>}
    {revise.length > 0 && <div className="card"><h2>Topics to revise</h2>{revise.slice(0, 8).map(r => <div key={r.id} className="row"><span style={{ flex: 1 }}><b>{r.name}</b> <span className="mu">({r.subject}) {r.reasons.join(', ')}</span></span>
      <span className="mu">I now feel:</span>{[1, 2, 3, 4, 5].map(c => <button key={c} className="g" onClick={() => revised(r.topic, c)}>{c}</button>)}</div>)}</div>}
    {subs.length === 0 && <div className="card mu">No subjects yet. Add your first subject above.</div>}
    {subs.map(s => { const ts = tops.filter(t => t.subject_id === s.id), c = ts.filter(t => t.is_completed).length, pct = ts.length ? Math.round(c / ts.length * 100) : 0, ne = nextExam(s.id);
      return (<div className="card" key={s.id} style={{ borderLeft: `4px solid ${s.color}` }}>
        <div className="row"><b style={{ flex: 1 }}>{s.name} {s.code && <span className="mu">{s.code}</span>}</b><span className="mu">{c}/{ts.length} topics · {pct}%</span>
          <button className="g" onClick={() => confirm(`Delete ${s.name} and its topics?`) && run(supabase!.from('subjects').delete().eq('id', s.id))}>Delete</button></div>
        <div style={{ height: 6, background: 'var(--bd)', borderRadius: 4, margin: '8px 0' }}><div style={{ width: `${pct}%`, height: 6, background: 'var(--ac2)', borderRadius: 4 }} /></div>
        <div className="mu">{ne ? `Exam: ${ne.toLocaleDateString()} (${Math.ceil((+ne - +now) / 864e5)} days)` : 'No upcoming exam'}</div>
        {ts.map(t => <div key={t.id} className="row"><label style={{ flex: 1 }}><input type="checkbox" checked={t.is_completed} onChange={e => patch(t, { is_completed: e.target.checked, completed_at: e.target.checked ? new Date().toISOString() : null, last_revised_at: e.target.checked ? new Date().toISOString() : t.last_revised_at })} /> {t.name}</label>
          <button className="g" onClick={() => patch(t, { needs_revision: !t.needs_revision })}>{t.needs_revision ? 'Needs revision ✓' : 'Needs revision?'}</button></div>)}
        <div className="row"><input placeholder="Add topic" value={newTopic[s.id] || ''} onChange={e => setNewTopic({ ...newTopic, [s.id]: e.target.value })} /><button className="g" onClick={() => addTopic(s)}>Add topic</button>
          <input type="date" value={examD[s.id] || ''} onChange={e => setExamD({ ...examD, [s.id]: e.target.value })} /><button className="g" onClick={() => addExam(s)}>Set exam</button></div></div>); })}
  </>);
}
