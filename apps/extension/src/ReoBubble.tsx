import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config';

/* ── Escalation thresholds (seconds) ── */
const THRESHOLDS = [
  { seconds: 30, level: 0 },   // gentle
  { seconds: 120, level: 1 },  // firm
  { seconds: 300, level: 2 },  // savage
];

const DEFAULT_BLOCKED_SITES = ['youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'reddit.com'];

export function ReoBubble() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastNudgeLevel, setLastNudgeLevel] = useState(-1);
  const [deviceToken, setDeviceToken] = useState('extension-default');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDistractiveRef = useRef(false);
  const lastNudgeTimeRef = useRef(0); // Task 3: client-side debounce

  // Load or create device token from chrome.storage
  useEffect(() => {
    chrome.storage.local.get('reo_device_token', (result) => {
      if (result.reo_device_token) {
        setDeviceToken(result.reo_device_token);
      } else {
        const newToken = 'ext-' + crypto.randomUUID();
        chrome.storage.local.set({ reo_device_token: newToken });
        setDeviceToken(newToken);
        // Register the new token with the backend
        fetch(`${API_BASE_URL}/api/reo/device/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_token: newToken }),
        }).catch(() => {});
      }
    });
  }, []);

  const triggerNudge = async (escalationLevel: number) => {
    if (isLoading) return;

    // Task 3: Client-side 60s debounce
    if (Date.now() - lastNudgeTimeRef.current < 60000) return;

    setIsLoading(true);
    lastNudgeTimeRef.current = Date.now();

    const siteUrl = window.location.href;

    try {
      // Try nudge API
      const res = await fetch(`${API_BASE_URL}/api/reo/nudge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': deviceToken,
        },
        body: JSON.stringify({
          site_url: siteUrl,
          time_on_site_seconds: elapsedSec,
          escalation_level: escalationLevel,
        }),
      });
      const data = await res.json();
      // If server returned cached response, still show it
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

  // Task 2: Detect distracting site using synced blocked_sites from chrome.storage
  useEffect(() => {
    const url = window.location.hostname.replace('www.', '');

    // Never nudge on Reo's own dashboard or productive sites
    const whitelist = ['run.app', 'localhost', 'github.com', 'docs.google.com', 'drive.google.com',
      'notion.so', 'figma.com', 'stackoverflow.com', 'gitlab.com', 'supabase.com'];
    const isWhitelisted = whitelist.some(s => url.includes(s));

    if (isWhitelisted) return;

    // Read blocked sites from chrome.storage (synced from Supabase), fallback to defaults
    chrome.storage.local.get('reo_blocked_sites', (result) => {
      const blockedSites: string[] = (result.reo_blocked_sites && Array.isArray(result.reo_blocked_sites))
        ? result.reo_blocked_sites
        : DEFAULT_BLOCKED_SITES;

      isDistractiveRef.current = blockedSites.some(s => url.includes(s));

      if (isDistractiveRef.current) {
        timerRef.current = setInterval(() => {
          setElapsedSec(prev => prev + 1);
        }, 1000);
      }
    });

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
