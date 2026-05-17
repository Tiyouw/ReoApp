import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'https://reo-backend-287020541953.us-central1.run.app';

/* ── Escalation thresholds (seconds) ── */
const THRESHOLDS = [
  { seconds: 30, level: 0 },   // gentle
  { seconds: 120, level: 1 },  // firm
  { seconds: 300, level: 2 },  // savage
];

function getDeviceToken(): string {
  // Sync with web dashboard token
  return localStorage.getItem('reo_device_token') || 'extension-default';
}

export function ReoBubble() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastNudgeLevel, setLastNudgeLevel] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDistractiveRef = useRef(false);

  const triggerNudge = async (escalationLevel: number) => {
    if (isLoading) return;
    setIsLoading(true);

    const token = getDeviceToken();
    const siteUrl = window.location.href;

    try {
      // Try new nudge API first
      const res = await fetch(`${API_BASE}/api/reo/nudge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': token,
        },
        body: JSON.stringify({
          site_url: siteUrl,
          time_on_site_seconds: elapsedSec,
          escalation_level: escalationLevel,
        }),
      });
      const data = await res.json();
      setMessage(data.message || 'Hey! Get back to work!');
    } catch {
      // Fallback to old chat API via background script
      chrome.runtime.sendMessage(
        { action: 'fetchChat', context: `User on ${siteUrl} for ${elapsedSec}s` },
        (response: any) => {
          if (chrome.runtime.lastError || !response?.success) {
            setMessage('Heh! Balik kerja dong!');
          } else {
            setMessage(response.message);
          }
        }
      );
    }

    setIsLoading(false);
    setVisible(true);
    setLastNudgeLevel(escalationLevel);
  };

  // Detect distracting site and start timer
  useEffect(() => {
    const url = window.location.hostname.replace('www.', '');
    const defaultSites = ['youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'reddit.com'];
    isDistractiveRef.current = defaultSites.some(s => url.includes(s));

    if (isDistractiveRef.current) {
      timerRef.current = setInterval(() => {
        setElapsedSec(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Progressive nudging based on elapsed time
  useEffect(() => {
    if (!isDistractiveRef.current) return;

    for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
      const t = THRESHOLDS[i];
      if (elapsedSec >= t.seconds && lastNudgeLevel < t.level) {
        triggerNudge(t.level);
        break;
      }
    }
  }, [elapsedSec]);

  // Auto-hide message after 20 seconds
  useEffect(() => {
    if (message) {
      const hideId = setTimeout(() => {
        setMessage('');
        setVisible(false);
      }, 20000);
      return () => clearTimeout(hideId);
    }
  }, [message]);

  // Escalation indicator color
  const dotColor = lastNudgeLevel >= 2 ? '#DC2626' : lastNudgeLevel >= 1 ? '#EA580C' : '#16A34A';

  return (
    <>
      {message && (
        <div className="reo-bubble">
          <div className="reo-bubble-text">{message}</div>
          {isDistractiveRef.current && (
            <div className="reo-bubble-timer">
              {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s on this site
            </div>
          )}
        </div>
      )}
      <div
        className="reo-blob"
        onClick={() => triggerNudge(Math.min((lastNudgeLevel || 0) + 1, 2))}
        title="Click to poke Reo"
      >
        {isDistractiveRef.current && (
          <div className="reo-indicator" style={{ backgroundColor: dotColor }} />
        )}
        <img
          src={chrome.runtime.getURL('mascot.png')}
          alt="Reo Mascot"
          width={90}
          height={90}
          style={{
            opacity: isLoading ? 0.7 : 1,
            filter: isLoading ? 'grayscale(50%)' : 'none',
          }}
        />
      </div>
    </>
  );
}
