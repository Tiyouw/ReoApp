import React, { useState, useEffect } from 'react';
import { reoApi } from '../api';
import { icons } from '../icons';

const PERSONAS = [
  { value: 'jowo', label: 'Savage Jowo', desc: 'Galak & lucu — Javanese tough love', color: 'bg-[#FEF2F2] text-[#DC2626]' },
  { value: 'jaksel', label: 'Anak Jaksel', desc: 'Sok asik — South Jakarta slang vibes', color: 'bg-[#FFF7ED] text-[#EA580C]' },
  { value: 'professional', label: 'Professional', desc: 'Kaku — polite & straight to the point', color: 'bg-[#DBEAFE] text-[#2563EB]' },
];

const FEATURES = [
  { icon: icons.shield, title: 'Anti-Doomscroll', desc: 'Auto-detects YouTube, Twitter & Instagram — nudges you back to work.', bg: 'bg-[#DBEAFE]', fg: 'text-[#2563EB]' },
  { icon: icons.masks, title: '3 Personality Modes', desc: 'From savage Javanese scolding to professional reminders.', bg: 'bg-[#FFF7ED]', fg: 'text-[#EA580C]' },
  { icon: icons.sparkles, title: 'Gemini AI Powered', desc: 'Dynamic, context-aware messages that actually hit different.', bg: 'bg-[#F0FDF4]', fg: 'text-[#16A34A]' },
  { icon: icons.puzzle, title: 'Chrome Extension', desc: 'Lives in your browser — intervenes right when you need it.', bg: 'bg-[#FDF4FF]', fg: 'text-[#9333EA]' },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up? Let\u2019s be productive';
  if (h < 12) return 'Good morning! Ready to grind?';
  if (h < 17) return 'Good afternoon! Stay focused';
  if (h < 21) return 'Good evening! Finish strong';
  return 'Night owl mode activated';
}

export function HomeTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [persona, setPersona] = useState('jowo');
  const [task, setTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reoApi.getState().then(data => {
      setPersona(data.persona || 'jowo');
      setTask(data.task || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await reoApi.saveState({ persona, task });
      setSaved(true);
      showToast('Settings saved — Reo is ready');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      showToast('Failed to save. Check your connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex flex-col items-center gap-4 py-20">
      <div className="w-48 h-2 skeleton" />
      <div className="w-32 h-2 skeleton" />
    </div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
      {/* Hero */}
      <div className="card-featured md:col-span-8 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>{getGreeting()}</p>
          <h1 className="text-2xl md:text-[2rem] font-extrabold leading-tight tracking-tight mb-3" style={{ textWrap: 'balance' as any }}>
            Your Buddy for Getting Things&nbsp;Done
          </h1>
          <p className="text-[0.9375rem] leading-relaxed max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
            Reo keeps you focused, accountable, and moving forward — together.
          </p>
        </div>
        <div className="flex-shrink-0 mascot-idle">
          <img src="/mascot.png" alt="Reo mascot" width={144} height={144} className="object-contain" fetchPriority="high" />
        </div>
      </div>

      {/* Accent */}
      <div className="card md:col-span-4 flex flex-col justify-center gap-3 text-center">
        <div className="feature-icon bg-[#DBEAFE] text-[#2563EB] mx-auto">{icons.target}</div>
        <h2 className="text-lg font-extrabold leading-snug">Less Procrastinating.<br />More Finishing.</h2>
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Powered by Gemini&nbsp;AI</p>
      </div>

      {/* Task + Persona wrapped in form */}
      <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
        {/* Task */}
        <div className="card md:col-span-7">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="step-num">1</div>
            <h2 className="text-lg font-bold tracking-tight">Set Your Target</h2>
          </div>
          <label htmlFor="task-input" className="text-sm font-medium block mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            What are you working on right now?
          </label>
          <input id="task-input" name="task" type="text" value={task} onChange={e => setTask(e.target.value)}
            placeholder="e.g. Writing my thesis chapter 2…" className="input-field mb-2" autoComplete="off" />
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {saved ? '✓ Saved! Reo will use this.' : 'Press Enter or click Save to confirm. Reo will remind you about this.'}
          </p>
        </div>

        {/* Persona */}
        <div className="card md:col-span-5 flex flex-col">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="step-num">2</div>
            <h2 className="text-lg font-bold tracking-tight">Pick a Vibe</h2>
          </div>
          <fieldset className="flex flex-col gap-2 flex-1">
            <legend className="sr-only">Choose Reo's personality</legend>
            {PERSONAS.map(p => (
              <button key={p.value} type="button" role="radio" aria-checked={persona === p.value}
                onClick={() => setPersona(p.value)} className="persona-option" data-selected={persona === p.value}>
                <span className={`badge ${p.color} text-[0.6875rem]`}>{p.label.split(' ')[0]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{p.desc}</div>
                </div>
                {persona === p.value && <span className="text-[#2563EB]">{icons.check}</span>}
              </button>
            ))}
          </fieldset>
          <button type="submit" disabled={saving} className="btn-primary w-full mt-5" aria-label="Save Reo settings">
            {saving ? <>{icons.loader} Saving…</> : saved ? <>{icons.check} Saved!</> : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Features */}
      <div className="md:col-span-12 mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="card flex flex-col gap-3">
              <div className={`feature-icon ${f.bg} ${f.fg}`}>{f.icon}</div>
              <h3 className="text-sm font-bold">{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
