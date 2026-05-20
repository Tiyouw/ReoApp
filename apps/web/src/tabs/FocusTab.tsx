import React, { useState, useEffect, useRef, useCallback } from 'react';
import { reoApi } from '../api';
import { icons } from '../icons';

/* ── Pomodoro Presets ── */
interface PomodoroPreset {
  name: string;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
}

const PRESETS: PomodoroPreset[] = [
  { name: 'Classic', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, roundsBeforeLongBreak: 4 },
  { name: 'Deep Work', workMinutes: 50, breakMinutes: 10, longBreakMinutes: 30, roundsBeforeLongBreak: 2 },
  { name: 'Sprint', workMinutes: 15, breakMinutes: 3, longBreakMinutes: 10, roundsBeforeLongBreak: 4 },
  { name: 'Custom', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, roundsBeforeLongBreak: 4 },
];

type Phase = 'idle' | 'work' | 'break' | 'longBreak';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const PHASE_COLORS: Record<Phase, string> = {
  idle: '#94A3B8',
  work: '#2563EB',
  break: '#16A34A',
  longBreak: '#9333EA',
};

export function FocusTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].workMinutes * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState('');
  const [completedToday, setCompletedToday] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [isIdle, setIsIdle] = useState(false);
  const [blockMode, setBlockMode] = useState(false);
  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [customLongBreak, setCustomLongBreak] = useState(15);
  const [customRounds, setCustomRounds] = useState(4);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const idleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load task + today's stats + block mode preference
  useEffect(() => {
    reoApi.getState().then(d => {
      setTask(d.task || '');
      if (d.block_mode_enabled) setBlockMode(true);
    }).catch(() => {});
    reoApi.getStats('1d').then(d => {
      setCompletedToday(d.total_focus_minutes > 0 ? Math.ceil(d.total_focus_minutes / 25) : 0);
      setTotalMinutes(d.total_focus_minutes || 0);
    }).catch(() => {});
  }, []);

  // Update timer when preset changes (only when idle)
  useEffect(() => {
    if (phase === 'idle') setSecondsLeft(preset.workMinutes * 60);
  }, [preset, phase]);

  // Idle detection
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isIdle && running) {
      setIsIdle(false);
      showToast('Welcome back! Timer resumed.');
    }
  }, [isIdle, running, showToast]);

  useEffect(() => {
    if (phase === 'idle') return;
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) handleActivity(); });

    idleCheckRef.current = setInterval(() => {
      if (phase !== 'work') return; // Only idle-check during work
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS && !isIdle) {
        setIsIdle(true);
        setRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 30000);

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (idleCheckRef.current) clearInterval(idleCheckRef.current);
    };
  }, [phase, handleActivity, isIdle]);

  // Timer tick
  useEffect(() => {
    if (running && secondsLeft > 0 && !isIdle) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            handlePhaseComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, isIdle]);

  // Phase transition
  const handlePhaseComplete = async () => {
    setRunning(false);

    if (phase === 'work') {
      // End work phase — record to backend
      if (sessionId) {
        try {
          await reoApi.endFocus(sessionId, true);
          setTotalMinutes(m => m + preset.workMinutes);
          setCompletedToday(c => c + 1);
        } catch {}
      }
      setSessionId(null);

      // Determine next phase
      if (round >= preset.roundsBeforeLongBreak) {
        setPhase('longBreak');
        setSecondsLeft(preset.longBreakMinutes * 60);
        showToast(`🎉 Round ${round} done! Enjoy a long break.`);
      } else {
        setPhase('break');
        setSecondsLeft(preset.breakMinutes * 60);
        showToast(`✅ Round ${round}/${preset.roundsBeforeLongBreak} done! Take a break.`);
      }
      // Auto-start break
      setTimeout(() => setRunning(true), 500);
    } else {
      // Break/long break complete — notify user
      if (Notification.permission === 'granted') {
        new Notification('Reo — Break Over! ⏰', {
          body: phase === 'longBreak' ? 'Cycle complete! Ready for a fresh set?' : `Time for round ${round + 1}! Let's go.`,
          icon: '/mascot.png',
        });
      }
      if (phase === 'longBreak') {
        setRound(1);
        showToast('🔄 Cycle complete! Ready for a new set?');
        setPhase('idle');
        setSecondsLeft(preset.workMinutes * 60);
        // Clear focus state on cycle end
        reoApi.saveState({ focus_active: false }).catch(() => {});
      } else {
        setRound(r => r + 1);
        showToast(`Break's over! Ready for round ${round + 1}?`);
        setPhase('idle');
        setSecondsLeft(preset.workMinutes * 60);
      }
    }
  };

  const handleStart = async () => {
    // Apply custom preset values if Custom is selected
    const activePreset = preset.name === 'Custom'
      ? { ...preset, workMinutes: customWork, breakMinutes: customBreak, longBreakMinutes: customLongBreak, roundsBeforeLongBreak: customRounds }
      : preset;
    if (preset.name === 'Custom') setPreset(activePreset);

    try {
      const res = await reoApi.startFocus(task);
      setSessionId(res.session_id);
      setPhase('work');
      setSecondsLeft(activePreset.workMinutes * 60);
      setRunning(true);
      setIsIdle(false);
      lastActivityRef.current = Date.now();
      // Broadcast focus state to backend (extension will sync)
      reoApi.saveState({ focus_active: true, focus_task: task, block_mode_enabled: blockMode }).catch(() => {});
      showToast(`Work phase ${round}/${activePreset.roundsBeforeLongBreak} — lock in!`);
    } catch {
      showToast('Failed to start session', 'error');
    }
  };

  const handleStop = async () => {
    setRunning(false);
    setIsIdle(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (sessionId) {
      try { await reoApi.endFocus(sessionId, false); } catch {}
    }
    setSessionId(null);
    setPhase('idle');
    setRound(1);
    setSecondsLeft(preset.workMinutes * 60);
    // Clear focus state on backend
    reoApi.saveState({ focus_active: false }).catch(() => {});
    showToast('Session cancelled', 'error');
  };

  const handlePause = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleResume = () => {
    setIsIdle(false);
    lastActivityRef.current = Date.now();
    setRunning(true);
  };

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    handlePhaseComplete();
  };

  const currentDuration = phase === 'work' ? preset.workMinutes
    : phase === 'break' ? preset.breakMinutes
    : phase === 'longBreak' ? preset.longBreakMinutes
    : preset.workMinutes;

  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const progress = 1 - secondsLeft / (currentDuration * 60);
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress);
  const activeColor = isIdle ? '#94A3B8' : PHASE_COLORS[phase];

  const phaseLabel = phase === 'work' ? `Work ${round}/${preset.roundsBeforeLongBreak}`
    : phase === 'break' ? 'Break'
    : phase === 'longBreak' ? 'Long Break'
    : `${preset.name} Pomodoro`;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Preset selector */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-2 flex-wrap justify-center">
            {PRESETS.map(p => (
              <button key={p.name} type="button" onClick={() => setPreset(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  p.name === preset.name
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'bg-[#F1F5F9] hover:bg-[#E2E8F0]'
                }`} style={p.name !== preset.name ? { color: 'var(--color-text-secondary)' } : {}}>
                {p.name}
              </button>
            ))}
          </div>

          {/* Custom preset inputs */}
          {preset.name === 'Custom' && (
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Work (min)</span>
                <input type="number" min={1} max={120} value={customWork} onChange={e => setCustomWork(+e.target.value || 1)}
                  className="input-field text-sm text-center" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Break (min)</span>
                <input type="number" min={1} max={30} value={customBreak} onChange={e => setCustomBreak(+e.target.value || 1)}
                  className="input-field text-sm text-center" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Long break (min)</span>
                <input type="number" min={1} max={60} value={customLongBreak} onChange={e => setCustomLongBreak(+e.target.value || 1)}
                  className="input-field text-sm text-center" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Rounds</span>
                <input type="number" min={1} max={10} value={customRounds} onChange={e => setCustomRounds(+e.target.value || 1)}
                  className="input-field text-sm text-center" />
              </label>
            </div>
          )}

          {/* Block mode toggle */}
          <div className="flex items-center gap-3 w-full max-w-sm px-3 py-2.5 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">🚫 Block distracting sites</p>
              <p className="text-[0.6875rem]" style={{ color: 'var(--color-text-tertiary)' }}>Full-page blocker during focus</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !blockMode;
                setBlockMode(next);
                reoApi.saveState({ block_mode_enabled: next }).catch(() => {});
              }}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                blockMode ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'
              }`}
              role="switch" aria-checked={blockMode} aria-label="Toggle site blocking">
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                blockMode ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* Phase indicator */}
      {phase !== 'idle' && (
        <div className="flex items-center gap-2">
          {Array.from({ length: preset.roundsBeforeLongBreak }).map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              i < round - (phase === 'work' ? 1 : 0) ? 'bg-[#2563EB]'
              : i === round - 1 && phase === 'work' ? 'bg-[#2563EB] ring-2 ring-[#2563EB]/30'
              : 'bg-[#E2E8F0]'
            }`} />
          ))}
          <span className="text-xs font-semibold ml-2 px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${activeColor}20`, color: activeColor }}>
            {phaseLabel}
          </span>
        </div>
      )}

      {/* Idle banner */}
      {isIdle && sessionId && (
        <div className="w-full max-w-sm bg-[#FFF7ED] border border-[#FDBA74] rounded-xl px-4 py-3 text-center">
          <p className="text-sm font-semibold text-[#EA580C]">⏸️ Paused — You seem away</p>
          <p className="text-xs text-[#9A3412] mt-1">Timer will resume when you return.</p>
        </div>
      )}

      {/* Timer circle */}
      <div className="relative w-56 h-56">
        <svg width="224" height="224" viewBox="0 0 200 200" aria-label={`${min} minutes ${sec} seconds remaining`}>
          <circle cx="100" cy="100" r="90" fill="none" stroke="#E2E8F0" strokeWidth="6" />
          <circle cx="100" cy="100" r="90" fill="none"
            stroke={activeColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.5s' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-extrabold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
          </div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {isIdle ? '⏸ Away — paused' : running ? phaseLabel : phase !== 'idle' ? 'Paused' : phaseLabel}
          </div>
        </div>
      </div>

      {/* Task label */}
      {task && (
        <div className="badge badge-blue text-sm px-3 py-1.5">
          {icons.target} <span className="ml-1">{task}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {phase === 'idle' ? (
          <button className="btn-primary px-8" onClick={handleStart}>
            {icons.play} Start Focus
          </button>
        ) : running ? (
          <>
            <button className="btn-primary bg-[#475569] hover:bg-[#334155]" onClick={handlePause}>
              {icons.pause} Pause
            </button>
            {phase !== 'work' && (
              <button className="btn-primary bg-[#9333EA] hover:bg-[#7C3AED]" onClick={handleSkip}>
                ⏭ Skip
              </button>
            )}
            <button className="btn-primary bg-[#DC2626] hover:bg-[#B91C1C]" onClick={handleStop}>
              {icons.square} Stop
            </button>
          </>
        ) : (
          <>
            <button className="btn-primary" onClick={handleResume}>
              {icons.play} Resume
            </button>
            <button className="btn-primary bg-[#DC2626] hover:bg-[#B91C1C]" onClick={handleStop}>
              {icons.square} Stop
            </button>
          </>
        )}
      </div>

      {/* Today's stats */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
        <div className="card text-center py-3">
          <div className="text-xl font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{completedToday}</div>
          <div className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Sessions Today</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-xl font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{totalMinutes}m</div>
          <div className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>Total Focused</div>
        </div>
      </div>

      {/* Preset details */}
      {phase === 'idle' && (
        <div className="text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {preset.name === 'Custom' ? customWork : preset.workMinutes}m work → {preset.name === 'Custom' ? customBreak : preset.breakMinutes}m break × {preset.name === 'Custom' ? customRounds : preset.roundsBeforeLongBreak} rounds → {preset.name === 'Custom' ? customLongBreak : preset.longBreakMinutes}m long break
        </div>
      )}
    </div>
  );
}
