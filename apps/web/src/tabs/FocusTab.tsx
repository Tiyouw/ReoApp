import React, { useState, useEffect, useRef } from 'react';
import { reoApi } from '../api';
import { icons } from '../icons';

const DEFAULT_MINUTES = 25;

export function FocusTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState('');
  const [completedToday, setCompletedToday] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load task from settings
  useEffect(() => {
    reoApi.getState().then(d => setTask(d.task || '')).catch(() => {});
  }, []);

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
      setSecondsLeft(DEFAULT_MINUTES * 60);
      setRunning(true);
      showToast('Focus session started — lock in!');
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
        showToast(`Session complete! ${DEFAULT_MINUTES} min focused.`);
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
    setSecondsLeft(DEFAULT_MINUTES * 60);
    showToast('Session cancelled', 'error');
  };

  const handlePause = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleResume = () => setRunning(true);

  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  const progress = 1 - secondsLeft / (DEFAULT_MINUTES * 60);
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Timer circle */}
      <div className="relative w-56 h-56">
        <svg width="224" height="224" viewBox="0 0 200 200" aria-label={`${min} minutes ${sec} seconds remaining`}>
          <circle cx="100" cy="100" r="90" fill="none" stroke="#E2E8F0" strokeWidth="6" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="#2563EB" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 0.5s ease-out' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-extrabold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
          </div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {running ? 'Focusing…' : sessionId ? 'Paused' : 'Ready'}
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

      {/* Today's sessions */}
      <div className="card w-full max-w-sm text-center mt-2">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold">
          {icons.trophy}
          <span>Today: {completedToday} session{completedToday !== 1 ? 's' : ''} completed</span>
        </div>
      </div>
    </div>
  );
}
