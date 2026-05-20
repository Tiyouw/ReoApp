import React, { useState, useEffect, useRef } from 'react';

const COUNTDOWN_SECONDS = 10;

interface BlockerProps {
  task: string;
  onDismiss: () => void; // "I need this for my task" — whitelist for session
  onGoBack: () => void;  // "Take me back" — navigate away
}

export function ReoBlocker({ task, onDismiss, onGoBack }: BlockerProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          // Auto-redirect: go back or new tab
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = 'about:blank';
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const domain = window.location.hostname.replace('www.', '');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2147483647,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.92))',
      backdropFilter: 'blur(8px)',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      animation: 'reo-blocker-in 0.3s ease-out',
    }}>
      <style>{`
        @keyframes reo-blocker-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes reo-blocker-card-in {
          from { opacity: 0; transform: scale(0.92) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes reo-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px) rotate(-1deg); }
          40% { transform: translateX(4px) rotate(1deg); }
          60% { transform: translateX(-3px) rotate(-0.5deg); }
          80% { transform: translateX(3px) rotate(0.5deg); }
        }
        @keyframes reo-countdown-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '40px 36px 32px',
        maxWidth: '420px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.08)',
        animation: 'reo-blocker-card-in 0.4s ease-out 0.1s both',
      }}>
        {/* Mascot */}
        <div style={{ animation: 'reo-shake 0.5s ease-in-out infinite', marginBottom: '16px' }}>
          <img
            src={chrome.runtime.getURL('mascot.png')}
            alt="Reo mascot — angry"
            width={100}
            height={100}
            style={{
              filter: 'hue-rotate(340deg) saturate(1.4) brightness(0.95)',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '22px',
          fontWeight: 800,
          color: '#DC2626',
          margin: '0 0 8px',
          lineHeight: 1.3,
        }}>
          🚫 Focus Mode Active!
        </h1>

        <p style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#475569',
          margin: '0 0 6px',
          lineHeight: 1.5,
        }}>
          You're in a focus session! Get back to:
        </p>

        {/* Task badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '8px',
          background: '#DBEAFE',
          color: '#2563EB',
          fontSize: '13px',
          fontWeight: 700,
          marginBottom: '20px',
        }}>
          🎯 {task || 'Your task'}
        </div>

        {/* Countdown */}
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#94A3B8',
          marginBottom: '20px',
        }}>
          <span style={{ color: '#DC2626' }}>
            {domain}
          </span>
          {' '}will close in{' '}
          <span style={{
            display: 'inline-block',
            fontSize: '20px',
            fontWeight: 800,
            color: countdown <= 3 ? '#DC2626' : '#0F172A',
            fontVariantNumeric: 'tabular-nums',
            animation: countdown <= 3 ? 'reo-countdown-pulse 0.5s ease-in-out infinite' : 'none',
            minWidth: '28px',
          }}>
            {countdown}s
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '4px',
          borderRadius: '2px',
          background: '#E2E8F0',
          marginBottom: '24px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100}%`,
            height: '100%',
            borderRadius: '2px',
            background: countdown <= 3 ? '#DC2626' : '#2563EB',
            transition: 'width 1s linear, background-color 0.3s',
          }} />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = '#93C5FD';
              e.currentTarget.style.background = '#EFF6FF';
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = '#E2E8F0';
              e.currentTarget.style.background = '#FFFFFF';
            }}
          >
            I need this for my task
          </button>
          <button
            onClick={onGoBack}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderRadius: '10px',
              background: '#2563EB',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              fontFamily: 'inherit',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = '#1D4ED8';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#2563EB';
            }}
          >
            ← Take me back
          </button>
        </div>
      </div>
    </div>
  );
}
