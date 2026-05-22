import React, { useState, useEffect } from 'react';
import { reoApi, getJwt, setJwt, clearJwt } from './api';
import { icons } from './icons';
import { HomeTab } from './tabs/HomeTab';
import { StatsTab } from './tabs/StatsTab';
import { FocusTab } from './tabs/FocusTab';
import { ChatTab } from './tabs/ChatTab';
import { SettingsTab } from './tabs/SettingsTab';

type Tab = 'home' | 'stats' | 'focus' | 'chat' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: icons.home },
  { id: 'stats', label: 'Stats', icon: icons.barChart },
  { id: 'focus', label: 'Focus', icon: icons.clock },
  { id: 'chat', label: 'Chat', icon: icons.messageCircle },
  { id: 'settings', label: 'Settings', icon: icons.settings },
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

/* ── Login Modal ── */
function LoginModal({ onClose, onLogin, showToast }: {
  onClose: () => void;
  onLogin: (email: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    try {
      await reoApi.authLogin(email.trim());
      setSent(true);
      showToast('Magic link sent! Check your email.');
    } catch {
      showToast('Failed to send magic link. Try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="card max-w-sm w-full p-6 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-3 right-3 text-[#94A3B8] hover:text-[#475569] transition-colors"
          aria-label="Close">
          {icons.x}
        </button>

        <div className="text-center mb-5">
          <div className="feature-icon bg-[#DBEAFE] text-[#2563EB] mx-auto mb-3">{icons.mail}</div>
          <h2 className="text-lg font-extrabold">Sign in to Reo</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Sync your data across devices with a magic link
          </p>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">📬</div>
            <p className="text-sm font-semibold mb-1">Check your inbox!</p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              We sent a magic link to <strong>{email}</strong>.
              Click it to sign in.
            </p>
            <button onClick={onClose} className="btn-primary w-full mt-5 text-sm">Got it</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input-field text-sm"
              autoFocus
              autoComplete="email"
              required
            />
            <button type="submit" disabled={sending || !email.trim()} className="btn-primary w-full text-sm">
              {sending ? <>{icons.loader} Sending…</> : <>{icons.mail} Send Magic Link</>}
            </button>
            <p className="text-[0.6875rem] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              No password needed — we'll email you a sign-in link.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Onboarding ── */
function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [task, setTask] = useState('');
  const [persona, setPersona] = useState('jowo');
  const [sweepPersona, setSweepPersona] = useState<string | null>(null);
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
                <button key={p.value} type="button"
                  onClick={() => {
                    setPersona(p.value);
                    setSweepPersona(p.value);
                    setTimeout(() => setSweepPersona(null), 600);
                  }}
                  className={`persona-option ${sweepPersona === p.value ? 'lightsweep-active' : ''}`}
                  data-selected={persona === p.value}
                  data-active-edit={persona === p.value}>
                  <div className="flex items-center justify-between w-full">
                    <span className={`badge ${p.color} text-[0.6875rem]`}>{p.label.split(' ')[0]}</span>
                    {persona === p.value && <span className="text-[#2563EB] flex-shrink-0">{icons.check}</span>}
                  </div>
                  <div className="w-full">
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="persona-desc text-xs leading-normal" style={{ color: 'var(--color-text-tertiary)' }}>{p.desc}</div>
                  </div>
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
  const [showLogin, setShowLogin] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Check for Supabase magic link token in URL hash on load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const accessToken = params.get('access_token');
      if (accessToken) {
        setJwt(accessToken);
        // Clean URL
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (!isNew) {
      reoApi.getState().then(() => setConnected(true)).catch(() => setConnected(false));

      // Register service worker for push notifications
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }

      // Check auth state
      if (getJwt()) {
        reoApi.authMe()
          .then(user => {
            if (user && user.id) {
              setAuthUser(user);
              // Auto-link device on first authenticated session
              reoApi.authLinkDevice().catch(() => {});
            } else {
              clearJwt();
            }
          })
          .catch(() => { clearJwt(); })
          .finally(() => setAuthChecked(true));
      } else {
        setAuthChecked(true);
      }
    }
  }, [isNew]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleSignOut = () => {
    clearJwt();
    setAuthUser(null);
    showToast('Signed out. Your data is still saved locally.');
  };

  if (isNew) {
    return <Onboarding onComplete={() => setIsNew(false)} />;
  }

  return (
    <>
      <Toast message={toastMsg} type={toastType} />
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={(email) => {
            setShowLogin(false);
          }}
          showToast={showToast}
        />
      )}
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
            <span className="badge badge-blue">v2.1</span>
            {authUser ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs font-medium truncate max-w-[140px]"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  {authUser.email}
                </span>
                <button onClick={handleSignOut}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border hover:bg-[#FEF2F2] hover:text-[#DC2626] hover:border-[#FCA5A5] transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  title="Sign out">
                  {icons.logOut}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border hover:bg-[#DBEAFE] hover:text-[#2563EB] hover:border-[#93C5FD] transition-colors"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                {icons.user} Sign in
              </button>
            )}
          </div>
        </header>

        {/* Tab Content */}
        {tab === 'home' && <HomeTab showToast={showToast} />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'focus' && <FocusTab showToast={showToast} />}
        {tab === 'chat' && <ChatTab />}
        {tab === 'settings' && <SettingsTab showToast={showToast} authUser={authUser} onSignIn={() => setShowLogin(true)} onSignOut={handleSignOut} />}
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
