import { motion } from 'framer-motion';
import { Previews } from './Previews';
const FEATURES = [['Smart task priorities', 'Every task gets a score and a plain-language reason: deadline, importance, effort and the time you actually have.'], ['Pomodoro that stays accurate', 'Timestamp-based timer that survives refreshes, sleep and tab switches.'], ['Deterministic study planner', 'Builds a schedule from deadlines and free hours. You approve every change.'],
  ['Spaced revision', 'Topics resurface when you are about to forget them, sooner before exams.'], ['Real analytics', 'Study time, consistency, planned vs actual. Calculated from your own records.'], ['Flow AI', 'An assistant that knows your subjects and tasks and explains the plan. Optional and server-side.']];
const STEPS = [['Add subjects and tasks', 'Set deadlines, topics and exam dates.'], ['Get your plan', 'See what to study next, and why. Approve the schedule.'], ['Focus and review', 'Run sessions, log time, revise on schedule.']];
const FAQ = [['Is my data private?', 'Yes. Every record is protected by row-level security so only you can read it.'], ['Do I need the AI?', 'No. Planning, priorities, timer and analytics work without any AI key.'], ['Will it make me study non-stop?', 'No. Rewards favor consistency and breaks are part of the plan.']];
const Q = [['“The reasons next to each task stopped me guessing what to do first.”', 'Sample student, sample content'], ['“Seeing my week laid out before exams helped me stay calm.”', 'Sample student, sample content']];
const sec = { maxWidth: 960, margin: '0 auto', padding: '40px 16px' } as const;

export function Landing({ onStart }: { onStart: () => void }) {
  return (<div>
    <section style={{ ...sec, textAlign: 'center', paddingTop: '10vh' }}>
      <motion.img src="/favicon.svg" width={72} alt="FocusFlow logo" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1, rotate: [0, 360] }} transition={{ duration: 1.2 }} />
      <h1 style={{ fontSize: 'clamp(2.2rem,6vw,3.6rem)', margin: '.2em 0', background: 'linear-gradient(90deg,#7c5cff,#22d3ee)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Take Control of Your Learning.</h1>
      <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mu" style={{ maxWidth: 560, margin: '0 auto 20px', fontSize: '1.1rem' }}>Your intelligent study companion. Plan your day, stay focused and turn your academic goals into achievements.</motion.p>
      <button onClick={onStart}>Start Your Journey</button> <button className="g" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Explore Features</button>
      <p className="mu" style={{ marginTop: 12 }}>Plan Smarter. Focus Deeper. Learn Better.</p></section>
    <Previews />
    <section id="features" style={sec}><h2>Features</h2><div className="row">{FEATURES.map(([t, d]) => <div className="card" key={t} style={{ flex: '1 1 260px' }}><b>{t}</b><p className="mu">{d}</p></div>)}</div></section>
    <section style={sec}><h2>How it works</h2><div className="row">{STEPS.map(([t, d], i) => <div className="card" key={t} style={{ flex: '1 1 240px' }}><b>{i + 1}. {t}</b><p className="mu">{d}</p></div>)}</div></section>
    <section style={sec}><h2>What students say <span className="mu">(sample content)</span></h2><div className="row">{Q.map(([q, a]) => <div className="card" key={q} style={{ flex: '1 1 300px' }}><p>{q}</p><span className="mu">{a}</span></div>)}</div></section>
    <section style={sec}><h2>FAQ</h2>{FAQ.map(([q, a]) => <details className="card" key={q}><summary><b>{q}</b></summary><p className="mu">{a}</p></details>)}</section>
    <footer style={{ ...sec, textAlign: 'center' }} className="mu"><div className="row" style={{ justifyContent: 'center' }}><a href="#features">Features</a><a href="#" onClick={e => { e.preventDefault(); onStart(); }}>Log in</a><a href="https://github.com" rel="noreferrer">GitHub</a></div><p>© FocusFlow. Plan Smarter. Focus Deeper. Learn Better.</p></footer>
  </div>);
}
