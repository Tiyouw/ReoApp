import React, { useState, useEffect, useRef } from 'react';
import { reoApi, Task as ApiTask } from '../api';
import { icons } from '../icons';
import { MascotMood as MascotMoodComponent, getMood, type MascotMood } from '../components/MascotMood';

const PERSONAS = [
  { value: 'jowo', label: 'Savage Jowo', desc: 'Galak & lucu — Javanese tough love', color: 'bg-[#FEF2F2] text-[#DC2626]' },
  { value: 'jaksel', label: 'Anak Jaksel', desc: 'Sok asik — South Jakarta slang vibes', color: 'bg-[#FFF7ED] text-[#EA580C]' },
  { value: 'professional', label: 'Professional', desc: 'Kaku — polite & straight to the point', color: 'bg-[#DBEAFE] text-[#2563EB]' },
  { value: 'sundanese', label: 'Urang Sunda', desc: 'Warm & teasing — brotherly Sundanese humor', color: 'bg-[#F0FDF4] text-[#16A34A]', isNew: true },
  { value: 'batak', label: 'Lae Batak', desc: 'Direct & loud — Batak uncle tells it straight', color: 'bg-[#FDF4FF] text-[#9333EA]', isNew: true },
  { value: 'corporate', label: 'Corporate Buzz', desc: 'Let\'s circle back — annoying corporate jargon', color: 'bg-[#F1F5F9] text-[#475569]', isNew: true },
];

const FEATURES = [
  { icon: icons.shield, title: 'Anti-Doomscroll', desc: 'Auto-detects YouTube, Twitter & Instagram — nudges you back to work.', bg: 'bg-[#DBEAFE]', fg: 'text-[#2563EB]' },
  { icon: icons.masks, title: '6 Personality Modes', desc: 'From Javanese scolding to corporate buzzwords.', bg: 'bg-[#FFF7ED]', fg: 'text-[#EA580C]' },
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

export function HomeTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [persona, setPersona] = useState('jowo');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<MascotMood>('happy');
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  // Get the active (first uncompleted) task
  const activeTask = tasks.find(t => !t.done)?.text || '';
  const completedCount = tasks.filter(t => t.done).length;

  // Task 4: Load tasks from Supabase on mount
  useEffect(() => {
    Promise.all([
      reoApi.getState().catch(() => null),
      reoApi.getTasks().catch(() => null),
      reoApi.getStats('1d').catch(() => null),
    ]).then(([state, apiTasks, todayStats]) => {
      if (state) setPersona(state.persona || 'jowo');

      if (apiTasks && apiTasks.length > 0) {
        // Map API tasks to local format
        setTasks(apiTasks.map(t => ({
          id: t.id,
          text: t.title,
          done: t.completed,
        })));
      } else if (state?.task) {
        // Seed from backend state if no tasks exist yet
        reoApi.createTask(state.task).then(created => {
          setTasks([{ id: created.id, text: created.title, done: false }]);
        }).catch(() => {});
      }

      // Compute mascot mood from today's stats
      if (todayStats) {
        setMood(getMood({
          streak: todayStats.streak_days || 0,
          nudgesToday: todayStats.total_nudges || 0,
          focusToday: todayStats.total_focus_minutes || 0,
        }));
      }

      setLoading(false);
    });
  }, []);

  // Sync active task to backend settings whenever tasks change
  useEffect(() => {
    if (!loading && tasks.length > 0) {
      const active = tasks.find(t => !t.done)?.text || '';
      reoApi.saveState({ task: active }).catch(() => {});
    }
  }, [tasks, loading]);

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

  // Task 4: Create task via API
  const addTask = async () => {
    const text = newTask.trim();
    if (!text) return;
    setNewTask('');

    // Optimistic UI
    const tempId = crypto.randomUUID();
    setTasks(prev => [...prev, { id: tempId, text, done: false }]);

    try {
      const created = await reoApi.createTask(text);
      // Replace temp ID with real one
      setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: created.id } : t));
    } catch {
      showToast('Failed to add task', 'error');
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  };

  // Task 4: Toggle task via API
  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // Optimistic UI
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));

    try {
      await reoApi.updateTask(id, { completed: !task.done });
    } catch {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: task.done } : t));
    }
  };

  // Task 4: Delete task via API
  const removeTask = async (id: string) => {
    const removedTask = tasks.find(t => t.id === id);
    setTasks(prev => prev.filter(t => t.id !== id));

    try {
      await reoApi.deleteTask(id);
    } catch {
      // Revert on failure
      if (removedTask) setTasks(prev => [...prev, removedTask]);
    }
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const fromIdx = dragItem.current;
    const toIdx = dragOver.current;

    setTasks(prev => {
      const updated = [...prev];
      const [dragged] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, dragged);

      // Update positions on server
      updated.forEach((t, i) => {
        reoApi.updateTask(t.id, { position: i }).catch(() => {});
      });

      return updated;
    });
    dragItem.current = null;
    dragOver.current = null;
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
        <div className="flex-shrink-0">
          <MascotMoodComponent mood={mood} size={144} />
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
                <li key={t.id} draggable
                  onDragStart={() => { dragItem.current = i; }}
                  onDragEnter={() => { dragOver.current = i; }}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing ${
                    t.done ? 'opacity-50' : i === tasks.findIndex(x => !x.done) ? 'bg-[#DBEAFE]/50 ring-1 ring-[#2563EB]/20' : ''
                  }`}>
                  <span className="text-[#CBD5E1] flex-shrink-0 touch-none">{icons.grip}</span>
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
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
            <legend className="sr-only">Choose Reo's personality</legend>
            {PERSONAS.map(p => (
              <button key={p.value} type="button" role="radio" aria-checked={persona === p.value}
                onClick={() => setPersona(p.value)} className="persona-option" data-selected={persona === p.value}>
                <div className="flex items-center gap-1.5">
                  <span className={`badge ${p.color} text-[0.6875rem]`}>{p.label.split(' ')[0]}</span>
                  {(p as any).isNew && <span className="badge bg-[#D1FAE5] text-[#059669] text-[0.5625rem]">NEW</span>}
                </div>
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
