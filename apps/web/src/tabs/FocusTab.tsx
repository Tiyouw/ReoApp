import React, { useState, useEffect, useRef } from 'react';
import { reoApi } from '../api';
import { icons } from '../icons';

const DURATION_OPTIONS = [15, 25, 45, 60];

export function FocusTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState('');
  const [completedToday, setCompletedToday] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load task + today's stats
  useEffect(() => {
    reoApi.getState().then(d => setTask(d.task || '')).catch(() => {});
    reoApi.getStats('1d').then(d => {
      setCompletedToday(d.total_focus_minutes > 0 ? Math.ceil(d.total_focus_minutes / 25) : 0);
      setTotalMinutes(d.total_focus_minutes || 0);
    }).catch(() => {});
  }, []);

  // Update seconds when duration changes (only when not running)
  useEffect(() => {
    if (!sessionId) setSecondsLeft(duration * 60);
  }, [duration]);

  // Timer tick
  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            handleComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleStart = async () => {
    try {
      const res = await reoApi.startFocus(task);
      setSessionId(res.session_id);
      setSecondsLeft(duration * 60);
      setRunning(true);
      showToast(`${duration} min focus session started — lock in!`);
    } catch {
      showToast('Failed to start session', 'error');
    }
  };

  const handleComplete = async () => {
    setRunning(false);
    if (sessionId) {
      try {
        await reoApi.endFocus(sessionId, true);
        setCompletedToday(c => c + 1);
        setTotalMinutes(m => m + duration);
        showToast(`Session complete! ${duration} min focused.`);
      } catch {}
    }
    setSessionId(null);
  };

  const handleStop = async () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (sessionId) {
      try { await reoApi.endFocus(sessionId, false); } catch {}
    }
    setSessionId(null);
    setSecondsLeft(duration * 60);
    showToast('Session cancelled', 'error');
  };

  const handlePause = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleResume = () => setRunning(true);

  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const progress = 1 - secondsLeft / (duration * 60);
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Duration selector */}
      {!sessionId && (
        <div className="flex gap-2">
          {DURATION_OPTIONS.map(d => (
            <button key={d} type="button" onClick={() => setDuration(d)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                d === duration
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'bg-[#F1F5F9] hover:bg-[#E2E8F0]'
              }`} style={d !== duration ? { color: 'var(--color-text-secondary)' } : {}}>
              {d}m
            </button>
          ))}
        </div>
      )}

      {/* Timer circle */}
      <div className="relative w-56 h-56">
        <svg width="224" height="224" viewBox="0 0 200 200" aria-label={`${min} minutes ${sec} seconds remaining`}>
          <circle cx="100" cy="100" r="90" fill="none" stroke="#E2E8F0" strokeWidth="6" />
          <circle cx="100" cy="100" r="90" fill="none"
            stroke={progress > 0.8 ? '#DC2626' : progress > 0.5 ? '#EA580C' : '#2563EB'}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.5s' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-extrabold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
          </div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {running ? 'Focusing…' : sessionId ? 'Paused' : `${duration} min session`}
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
        {!sessionId ? (
          <button className="btn-primary px-8" onClick={handleStart}>
            {icons.play} Start Focus
          </button>
        ) : running ? (
          <>
            <button className="btn-primary bg-[#475569] hover:bg-[#334155]" onClick={handlePause}>
              {icons.pause} Pause
            </button>
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
    </div>
  );
}
