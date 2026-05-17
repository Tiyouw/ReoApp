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

interface Task {
  id: string;
  text: string;
  done: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up? Let\u2019s be productive';
  if (h < 12) return 'Good morning! Ready to grind?';
  if (h < 17) return 'Good afternoon! Stay focused';
  if (h < 21) return 'Good evening! Finish strong';
  return 'Night owl mode activated';
}

function loadTasks(): Task[] {
  try {
    return JSON.parse(localStorage.getItem('reo_tasks') || '[]');
  } catch { return []; }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem('reo_tasks', JSON.stringify(tasks));
}

export function HomeTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [persona, setPersona] = useState('jowo');
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [newTask, setNewTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get the active (first uncompleted) task
  const activeTask = tasks.find(t => !t.done)?.text || '';
  const completedCount = tasks.filter(t => t.done).length;

  useEffect(() => {
    reoApi.getState().then(data => {
      setPersona(data.persona || 'jowo');
      // If no local tasks but backend has one, seed it
      if (tasks.length === 0 && data.task) {
        const seeded = [{ id: crypto.randomUUID(), text: data.task, done: false }];
        setTasks(seeded);
        saveTasks(seeded);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Sync active task to backend whenever tasks change
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await reoApi.saveState({ persona, task: activeTask });
      setSaved(true);
      showToast('Settings saved — Reo knows your tasks now');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      showToast('Failed to save. Check your connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks(prev => [...prev, { id: crypto.randomUUID(), text, done: false }]);
    setNewTask('');
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
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
          {activeTask ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="badge badge-blue">{icons.target} Current Focus</span>
              <span className="font-semibold">{activeTask}</span>
            </div>
          ) : (
            <p className="text-[0.9375rem] leading-relaxed max-w-md" style={{ color: 'var(--color-text-secondary)' }}>
              Add a task below to get started!
            </p>
          )}
        </div>
        <div className="flex-shrink-0 mascot-idle">
          <img src="/mascot.png" alt="Reo mascot" width={144} height={144} className="object-contain" fetchPriority="high" />
        </div>
      </div>

      {/* Progress card */}
      <div className="card md:col-span-4 flex flex-col justify-center gap-3 text-center">
        <div className="feature-icon bg-[#DBEAFE] text-[#2563EB] mx-auto">{icons.target}</div>
        <h2 className="text-lg font-extrabold leading-snug">
          {tasks.length === 0 ? 'No Tasks Yet' : `${completedCount}/${tasks.length} Done`}
        </h2>
        {tasks.length > 0 && (
          <div className="w-full bg-[#E2E8F0] rounded-full h-2">
            <div className="bg-[#2563EB] h-2 rounded-full transition-all duration-500"
              style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }} />
          </div>
        )}
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Powered by Gemini&nbsp;AI</p>
      </div>

      {/* Task + Persona wrapped in form */}
      <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
        {/* Task List */}
        <div className="card md:col-span-7">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="step-num">1</div>
            <h2 className="text-lg font-bold tracking-tight">Your Tasks</h2>
            <span className="text-xs font-medium ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
              {tasks.length > 0 ? `${completedCount} of ${tasks.length} done` : ''}
            </span>
          </div>

          {/* Task input */}
          <div className="flex gap-2 mb-4">
            <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
              placeholder="Add a new task…" className="input-field flex-1" autoComplete="off" />
            <button type="button" onClick={addTask} disabled={!newTask.trim()}
              className="btn-primary px-3 flex-shrink-0" aria-label="Add task">
              {icons.plus}
            </button>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                No tasks yet. Add one above — Reo will remind you!
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {tasks.map((t, i) => (
                <li key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  t.done ? 'opacity-50' : i === tasks.findIndex(x => !x.done) ? 'bg-[#DBEAFE]/50 ring-1 ring-[#2563EB]/20' : ''
                }`}>
                  <button type="button" onClick={() => toggleTask(t.id)}
                    className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                      t.done ? 'bg-[#2563EB] border-[#2563EB] text-white' : 'border-[#CBD5E1]'
                    }`} aria-label={t.done ? 'Mark incomplete' : 'Mark complete'}>
                    {t.done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                  <span className={`text-sm flex-1 ${t.done ? 'line-through' : 'font-medium'}`}>{t.text}</span>
                  {!t.done && i === tasks.findIndex(x => !x.done) && (
                    <span className="badge badge-blue text-[0.625rem]">Active</span>
                  )}
                  <button type="button" onClick={() => removeTask(t.id)}
                    className="text-[#94A3B8] hover:text-[#DC2626] transition-colors flex-shrink-0" aria-label="Remove task">
                    {icons.x}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
