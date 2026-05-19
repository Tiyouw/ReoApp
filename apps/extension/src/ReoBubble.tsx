import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from './config';

/* ── Escalation thresholds (seconds) ── */
const THRESHOLDS = [
  { seconds: 30, level: 0 },   // gentle
  { seconds: 120, level: 1 },  // firm
  { seconds: 300, level: 2 },  // savage
];

const DEFAULT_BLOCKED_SITES = ['youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'reddit.com'];

/* ── TTS Voice Config (Task 2) ── */
const PERSONA_VOICE_MAP: Record<string, { rate: number; pitch: number }> = {
  jowo: { rate: 0.9, pitch: 1.1 },
  jaksel: { rate: 1.2, pitch: 1.0 },
  professional: { rate: 1.0, pitch: 0.9 },
  sundanese: { rate: 0.9, pitch: 1.1 },
  batak: { rate: 1.1, pitch: 0.8 },
  corporate: { rate: 1.0, pitch: 0.9 },
};

function speakNudge(message: string, persona: string, volume = 0.7) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  const config = PERSONA_VOICE_MAP[persona] || PERSONA_VOICE_MAP.professional;
  utterance.rate = config.rate;
  utterance.pitch = config.pitch;
  utterance.volume = volume;
  const voices = speechSynthesis.getVoices();
  const idVoice = voices.find(v => v.lang.startsWith('id'));
  if (idVoice && ['jowo', 'jaksel', 'sundanese', 'batak'].includes(persona)) {
    utterance.voice = idVoice;
  }
  speechSynthesis.speak(utterance);
}

export function ReoBubble() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastNudgeLevel, setLastNudgeLevel] = useState(-1);
  const [deviceToken, setDeviceToken] = useState('extension-default');
  const [isOnTask, setIsOnTask] = useState<boolean | null>(null); // Task 1: classification result
  const [classifyReason, setClassifyReason] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [currentPersona, setCurrentPersona] = useState('professional');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDistractiveRef = useRef(false);
  const lastNudgeTimeRef = useRef(0);
  const classifiedRef = useRef(false); // prevent re-classification

  // Load device token + voice/persona preferences
  useEffect(() => {
    chrome.storage.local.get(['reo_device_token', 'voice_enabled', 'reo_persona'], (result) => {
      if (result.reo_device_token) {
        setDeviceToken(result.reo_device_token);
      } else {
        const newToken = 'ext-' + crypto.randomUUID();
        chrome.storage.local.set({ reo_device_token: newToken });
        setDeviceToken(newToken);
        fetch(`${API_BASE_URL}/api/reo/device/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_token: newToken }),
        }).catch(() => {});
      }
      if (result.voice_enabled) setVoiceEnabled(true);
      if (result.reo_persona) setCurrentPersona(result.reo_persona);
    });
  }, []);

  const triggerNudge = async (escalationLevel: number) => {
    if (isLoading) return;
    if (Date.now() - lastNudgeTimeRef.current < 60000) return;

    // Task 1: Smart whitelisting — classify before nudging
    if (!classifiedRef.current) {
      classifiedRef.current = true;
      try {
        const classRes = await fetch(`${API_BASE_URL}/api/reo/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-device-token': deviceToken },
          body: JSON.stringify({ url: window.location.href, page_title: document.title }),
        });
        const classData = await classRes.json();
        if (classData.productive && classData.confidence > 0.7) {
          setIsOnTask(true);
          setClassifyReason(classData.reason);
          setMessage('✓ ' + classData.reason);
          setVisible(true);
          isDistractiveRef.current = false;
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => { setMessage(''); setVisible(false); }, 8000);
          return;
        } else {
          setIsOnTask(false);
        }
      } catch {
        // Classification failed — proceed with nudge as normal
      }
    }
    if (isOnTask === true) return;

    setIsLoading(true);
    lastNudgeTimeRef.current = Date.now();

    const siteUrl = window.location.href;

    try {
      const res = await fetch(`${API_BASE_URL}/api/reo/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-token': deviceToken },
        body: JSON.stringify({ site_url: siteUrl, time_on_site_seconds: elapsedSec, escalation_level: escalationLevel }),
      });
      const data = await res.json();
      const nudgeMsg = data.message || 'Hey! Get back to work!';
      setMessage(nudgeMsg);
      // Task 2: Voice nudge
      if (voiceEnabled) speakNudge(nudgeMsg, currentPersona);
    } catch {
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
  const dotColor = isOnTask === true ? '#16A34A'
    : lastNudgeLevel >= 2 ? '#DC2626' : lastNudgeLevel >= 1 ? '#EA580C' : '#16A34A';

  // "This is wrong" handler
  const handleFeedback = async () => {
    const domain = window.location.hostname.replace('www.', '');
    try {
      await fetch(`${API_BASE_URL}/api/reo/classify/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-token': deviceToken },
        body: JSON.stringify({ domain }),
      });
      classifiedRef.current = false;
      setIsOnTask(null);
      setMessage('Classification reset. I\'ll re-check next time!');
      setTimeout(() => { setMessage(''); setVisible(false); }, 4000);
    } catch {}
  };

  const toggleVoice = () => {
    const newVal = !voiceEnabled;
    setVoiceEnabled(newVal);
    chrome.storage.local.set({ voice_enabled: newVal });
  };

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
          {/* Feedback + Voice buttons */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            {isOnTask !== null && (
              <button onClick={handleFeedback}
                style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer', background: '#fff' }}>
                🔄 This is wrong
              </button>
            )}
            {'speechSynthesis' in window && (
              <button onClick={toggleVoice}
                style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer', background: voiceEnabled ? '#DBEAFE' : '#fff' }}>
                {voiceEnabled ? '🔊' : '🔇'}
              </button>
            )}
          </div>
        </div>
      )}
      <div
        className="reo-blob"
        onClick={() => triggerNudge(Math.min((lastNudgeLevel || 0) + 1, 2))}
        title="Click to poke Reo"
      >
        {isOnTask === true ? (
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#16A34A', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px', zIndex: 10 }}>✓ On-task</div>
        ) : isDistractiveRef.current ? (
          <div className="reo-indicator" style={{ backgroundColor: dotColor }} />
        ) : null}
        <img
          src={chrome.runtime.getURL('mascot.png')}
          alt="Reo Mascot"
          width={90}
          height={90}
          style={{
            opacity: isLoading ? 0.7 : 1,
            filter: isLoading ? 'grayscale(50%)' : isOnTask === true ? 'hue-rotate(100deg) saturate(0.8)' : 'none',
          }}
        />
      </div>
    </>
  );
}
