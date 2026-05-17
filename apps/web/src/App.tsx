import React, { useState, useEffect } from 'react';
import { reoApi } from './api';
import { icons } from './icons';
import { HomeTab } from './tabs/HomeTab';
import { StatsTab } from './tabs/StatsTab';
import { FocusTab } from './tabs/FocusTab';
import { ChatTab } from './tabs/ChatTab';

type Tab = 'home' | 'stats' | 'focus' | 'chat';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: icons.home },
  { id: 'stats', label: 'Stats', icon: icons.barChart },
  { id: 'focus', label: 'Focus', icon: icons.clock },
  { id: 'chat', label: 'Chat', icon: icons.messageCircle },
];

/* ── Toast ── */
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  if (!message) return null;
  return (
    <div className={`toast ${type === 'success' ? 'toast-success' : 'toast-error'}`}
      role="status" aria-live="polite">
      {type === 'success' ? icons.check : null} {message}
    </div>
  );
}

/* ── Onboarding ── */
function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [task, setTask] = useState('');
  const [persona, setPersona] = useState('jowo');
  const [saving, setSaving] = useState(false);

  const personas = [
    { value: 'jowo', label: 'Savage Jowo', desc: 'Galak & lucu — Javanese tough love', color: 'bg-[#FEF2F2] text-[#DC2626]' },
    { value: 'jaksel', label: 'Anak Jaksel', desc: 'Sok asik — South Jakarta slang', color: 'bg-[#FFF7ED] text-[#EA580C]' },
    { value: 'professional', label: 'Professional', desc: 'Kaku — polite & straight to the point', color: 'bg-[#DBEAFE] text-[#2563EB]' },
  ];

  const finish = async () => {
    setSaving(true);
    try {
      await reoApi.register();
      await reoApi.saveState({ persona, task });
    } catch {}
    setSaving(false);
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full p-8">
        {step === 0 && (
          <div className="text-center">
            <div className="mascot-idle inline-block mb-4">
              <img src="/mascot.png" alt="Reo mascot" width={120} height={120} className="object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold mb-2">Meet Reo</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              Your AI productivity buddy. Reo keeps you focused, accountable, and off distracting sites.
            </p>
            <button className="btn-primary w-full" onClick={() => setStep(1)}>Get Started</button>
          </div>
        )}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="step-num">1</div>
              <h2 className="text-lg font-bold">What Are You Working On?</h2>
            </div>
            <input type="text" value={task} onChange={e => setTask(e.target.value)}
              placeholder="e.g. Writing my thesis chapter 2…" className="input-field mb-4"
              name="task" autoComplete="off" />
            <button className="btn-primary w-full" onClick={() => setStep(2)}>Next</button>
          </div>
        )}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div className="step-num">2</div>
              <h2 className="text-lg font-bold">Pick Reo's Personality</h2>
            </div>
            <div className="flex flex-col gap-2 mb-5">
              {personas.map(p => (
                <button key={p.value} type="button" onClick={() => setPersona(p.value)}
                  className="persona-option" data-selected={persona === p.value}>
                  <span className={`badge ${p.color} text-[0.6875rem]`}>{p.label.split(' ')[0]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{p.desc}</div>
                  </div>
                  {persona === p.value && <span className="text-[#2563EB]">{icons.check}</span>}
                </button>
              ))}
            </div>
            <button className="btn-primary w-full" onClick={finish} disabled={saving}>
              {saving ? <>{icons.loader} Saving…</> : 'Launch Reo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main App ── */
export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [isNew, setIsNew] = useState(!localStorage.getItem('reo_device_token'));
  const [connected, setConnected] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (!isNew) {
      reoApi.getState().then(() => setConnected(true)).catch(() => setConnected(false));
    }
  }, [isNew]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3500);
  };

  if (isNew) {
    return <Onboarding onComplete={() => setIsNew(false)} />;
  }

  return (
    <>
      <Toast message={toastMsg} type={toastType} />
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-10 pb-28">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/mascot.png" alt="" width={32} height={32} className="object-contain" aria-hidden="true" />
            <span className="text-xl font-extrabold tracking-tight" translate="no">Reo</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: connected ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-[#16A34A] status-pulse' : 'bg-[#94A3B8]'}`} />
              {connected ? 'Connected' : 'Offline'}
            </div>
            <span className="badge badge-blue">Beta</span>
            <button type="button" onClick={() => setIsNew(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }} aria-label="Re-run onboarding" title="Setup wizard">
              {icons.settings}
            </button>
          </div>
        </header>

        {/* Tab Content */}
        {tab === 'home' && <HomeTab showToast={showToast} />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'focus' && <FocusTab showToast={showToast} />}
        {tab === 'chat' && <ChatTab />}
      </div>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40"
        style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors duration-150 ${
                tab === t.id ? 'text-[#2563EB]' : 'text-[#94A3B8] hover:text-[#475569]'
              }`}
              aria-label={t.label}
              aria-current={tab === t.id ? 'page' : undefined}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
