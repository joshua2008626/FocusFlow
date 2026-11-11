import { useState } from 'react';
import { supabase } from './supabase';

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  if (!supabase) return <div className="card">Supabase is not configured. Add keys to <code>apps/web/.env</code>.</div>;
  const go = async () => {
    setMsg('');
    const r = mode === 'in' ? await supabase!.auth.signInWithPassword({ email, password: pw })
      : mode === 'up' ? await supabase!.auth.signUp({ email, password: pw, options: { data: { full_name: name } } })
      : await supabase!.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (r.error) setMsg(r.error.message);
    else if (mode === 'up') setMsg('Check your email to confirm your account.');
    else if (mode === 'reset') setMsg('Password reset email sent.');
  };
  return (<div className="card" style={{ maxWidth: 420, margin: '8vh auto' }}>
    <h2>{mode === 'in' ? 'Welcome back' : mode === 'up' ? 'Create your account' : 'Reset password'}</h2>
    <div className="row">
      {mode === 'up' && <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />}
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      {mode !== 'reset' && <input type="password" placeholder="Password (8+ chars)" value={pw} onChange={e => setPw(e.target.value)} />}
      <button onClick={go}>{mode === 'in' ? 'Log in' : mode === 'up' ? 'Sign up' : 'Send reset link'}</button>
    </div>
    {msg && <p className="mu">{msg}</p>}
    <p className="mu"><a href="#" onClick={e => { e.preventDefault(); setMode(mode === 'in' ? 'up' : 'in'); }}>{mode === 'in' ? 'New here? Sign up' : 'Have an account? Log in'}</a>
      {' · '}<a href="#" onClick={e => { e.preventDefault(); setMode('reset'); }}>Forgot password?</a></p>
  </div>);
}
