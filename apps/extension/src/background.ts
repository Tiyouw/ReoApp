import { API_BASE_URL } from './config';

/* ── Sync state from Supabase every 5 minutes ── */
async function syncState() {
  try {
    const result = await chrome.storage.local.get('reo_device_token');
    const token = result.reo_device_token;
    if (!token) return;

    const res = await fetch(`${API_BASE_URL}/api/reo/state`, {
      headers: { 'x-device-token': token },
    });
    const data = await res.json();

    const updates: Record<string, any> = {};

    if (data.blocked_sites && Array.isArray(data.blocked_sites)) {
      updates.reo_blocked_sites = data.blocked_sites;
    }

    // Sync focus session state for the blocker
    updates.focus_active = !!data.focus_active;
    updates.block_mode_enabled = !!data.block_mode_enabled;
    updates.reo_focus_task = data.focus_task || data.task || '';

    // If focus just ended, clear session whitelist
    if (!data.focus_active) {
      updates.reo_session_whitelist = [];
    }

    // Sync persona
    if (data.persona) {
      updates.reo_persona = data.persona;
    }

    await chrome.storage.local.set(updates);
  } catch (err) {
    console.error('[Reo] Failed to sync state:', err);
  }
}

// Sync on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
  syncState();
  // Set up periodic sync every 5 minutes
  chrome.alarms.create('syncState', { periodInMinutes: 5 });
});

chrome.runtime.onStartup.addListener(() => {
  syncState();
});

// Handle alarm for periodic sync
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncState') {
    syncState();
  }
});

// Trigger sync immediately when token changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.reo_device_token) {
    syncState();
  }
});

/* ── Handle messages from content scripts ── */
chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
  if (request.action === 'fetchChat') {
    fetch(`${API_BASE_URL}/api/reo/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: request.context })
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, message: data.message }))
    .catch(err => sendResponse({ success: false, error: err.message }));
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});
