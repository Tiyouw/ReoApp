import React, { useState, useEffect } from 'react';

const API_BASE = 'https://reo-backend-287020541953.us-central1.run.app';

/* ─────────────────────────────────────
   SVG Icons (Lucide-style, consistent 24px / 1.5px stroke)
   ───────────────────────────────────── */
const icons = {
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  masks: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="10" r="6"/><path d="M14.83 14.83a6 6 0 1 0 1.34-9.66"/><path d="M7 10h4M15 10h2"/>
    </svg>
  ),
  sparkles: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4M19 17v4M3 5h4M17 19h4"/>
    </svg>
  ),
  puzzle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.969a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  loader: (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  target: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
};

/* ─── Mascot ─── */
const ReoMascot = ({ size = 160 }: { size?: number }) => (
  <img
    src="/mascot.png"
    alt="Reo mascot — a friendly round character"
    width={size}
    height={size}
    className="object-contain"
    fetchPriority="high"
  />
);

/* ─── Toast ─── */
const Toast = ({ message, type }: { message: string; type: 'success' | 'error' }) => {
  if (!message) return null;
  return (
    <div
      className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}
      role="status"
      aria-live="polite"
    >
      {type === 'success' ? icons.check : null}
      {message}
    </div>
  );
};

/* ─── Persona data ─── */
const PERSONAS = [
  { value: 'jowo', label: 'Savage Jowo', desc: 'Galak & lucu — Javanese tough love', color: 'bg-[#FEF2F2] text-[#DC2626]' },
  { value: 'jaksel', label: 'Anak Jaksel', desc: 'Sok asik — South Jakarta slang vibes', color: 'bg-[#FFF7ED] text-[#EA580C]' },
  { value: 'professional', label: 'Professional', desc: 'Kaku — polite & straight to the point', color: 'bg-[#DBEAFE] text-[#2563EB]' },
];

/* ─── Feature data ─── */
const FEATURES = [
  { icon: icons.shield, title: 'Anti-Doomscroll', desc: 'Auto-detects YouTube, Twitter & Instagram — nudges you back to work.', bg: 'bg-[#DBEAFE]', fg: 'text-[#2563EB]' },
  { icon: icons.masks, title: '3 Personality Modes', desc: 'From savage Javanese scolding to professional reminders.', bg: 'bg-[#FFF7ED]', fg: 'text-[#EA580C]' },
  { icon: icons.sparkles, title: 'Gemini AI Powered', desc: 'Dynamic, context-aware messages that actually hit different.', bg: 'bg-[#F0FDF4]', fg: 'text-[#16A34A]' },
  { icon: icons.puzzle, title: 'Chrome Extension', desc: 'Lives in your browser — intervenes right when you need it.', bg: 'bg-[#FDF4FF]', fg: 'text-[#9333EA]' },
];

/* ─── Greeting ─── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up? Let\u2019s be productive';
  if (h < 12) return 'Good morning! Ready to grind?';
  if (h < 17) return 'Good afternoon! Stay focused';
  if (h < 21) return 'Good evening! Finish strong';
  return 'Night owl mode activated';
}

/* ────────────────── App ────────────────── */
export default function App() {
  const [persona, setPersona] = useState('jowo');
  const [task, setTask] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    fetch(`${API_BASE}/api/reo/state`)
      .then(res => res.json())
      .then(data => {
        setPersona(data.persona);
        setTask(data.task);
        setLoading(false);
        setConnected(true);
      })
      .catch(() => {
        setLoading(false);
        setConnected(false);
      });
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/reo/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona, task }),
      });
      setSaved(true);
      showToast('Settings saved — Reo is ready');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      showToast('Failed to save. Check your connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5">
        <div className="w-20 h-20 mascot-idle">
          <ReoMascot size={80} />
        </div>
        <p className="text-base font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Waking Reo up…
        </p>
        <div className="w-48 h-1.5 skeleton" />
      </div>
    );
  }

  return (
    <>
      <Toast message={toastMsg} type={toastType} />

      <div className="max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-12">

        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <img src="/mascot.png" alt="" width={36} height={36} className="object-contain" aria-hidden="true" />
            <span className="text-xl font-extrabold tracking-tight" translate="no">Reo</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-[#16A34A] status-pulse' : 'bg-[#94A3B8]'}`}
              />
              {connected ? 'Connected' : 'Offline'}
            </div>
            <span className="badge badge-blue">Beta</span>
          </div>
        </header>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">

          {/* Hero */}
          <div className="card-featured md:col-span-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                {getGreeting()}
              </p>
              <h1 className="text-2xl md:text-[2rem] font-extrabold leading-tight tracking-tight mb-3" style={{ textWrap: 'balance' as any }}>
                Your Buddy for Getting Things&nbsp;Done
              </h1>
              <p className="text-[0.9375rem] leading-relaxed max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
                Reo keeps you focused, accountable, and moving forward—together. No more doomscrolling.
              </p>
            </div>
            <div className="flex-shrink-0 mascot-idle">
              <ReoMascot size={144} />
            </div>
          </div>

          {/* Accent card */}
          <div className="card md:col-span-4 flex flex-col justify-center gap-3 text-center">
            <div className="feature-icon bg-[#DBEAFE] text-[#2563EB] mx-auto">
              {icons.target}
            </div>
            <h2 className="text-lg font-extrabold leading-snug">
              Less Procrastinating.<br />More Finishing.
            </h2>
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
              Powered by Gemini&nbsp;AI
            </p>
          </div>

          {/* Task input */}
          <div className="card md:col-span-7">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="step-num">1</div>
              <h2 className="text-lg font-bold tracking-tight">Set Your Target</h2>
            </div>
            <div className="flex flex-col gap-3">
              <label htmlFor="task-input" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                What are you working on right now?
              </label>
              <input
                id="task-input"
                name="task"
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g. Writing my thesis chapter 2…"
                className="input-field"
                autoComplete="off"
              />
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                Reo will remind you about this specifically when you slack off.
              </p>
            </div>
          </div>

          {/* Persona picker */}
          <div className="card md:col-span-5 flex flex-col">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="step-num">2</div>
              <h2 className="text-lg font-bold tracking-tight">
                <label htmlFor="persona-group">Pick a Vibe</label>
              </h2>
            </div>

            <fieldset id="persona-group" className="flex flex-col gap-2 flex-1">
              <legend className="sr-only">Choose Reo's personality</legend>
              {PERSONAS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={persona === p.value}
                  onClick={() => setPersona(p.value)}
                  className="persona-option"
                  data-selected={persona === p.value}
                >
                  <span className={`badge ${p.color} text-[0.6875rem]`}>{p.label.split(' ')[0]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{p.desc}</div>
                  </div>
                  {persona === p.value && (
                    <span className="text-[#2563EB] flex-shrink-0">{icons.check}</span>
                  )}
                </button>
              ))}
            </fieldset>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full mt-5"
              aria-label="Save Reo settings"
            >
              {saving ? (
                <>{icons.loader} Saving…</>
              ) : saved ? (
                <>{icons.check} Saved!</>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>

          {/* ── Features ── */}
          <div className="md:col-span-12 mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
              How It Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((f, i) => (
                <div key={i} className="card flex flex-col gap-3">
                  <div className={`feature-icon ${f.bg} ${f.fg}`}>
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-bold">{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-14 pt-6 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-center gap-2 text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
            Built for <span className="badge badge-orange">JuaraVibeCoding</span>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Reo &copy; 2026
          </p>
        </footer>
      </div>
    </>
  );
}
