import { API_BASE_URL } from './config';

/* ── Sync blocked sites from Supabase every 5 minutes ── */
async function syncBlockedSites() {
  try {
    const result = await chrome.storage.local.get('reo_device_token');
    const token = result.reo_device_token;
    if (!token) return;

    const res = await fetch(`${API_BASE_URL}/api/reo/state`, {
      headers: { 'x-device-token': token },
    });
    const data = await res.json();

    if (data.blocked_sites && Array.isArray(data.blocked_sites)) {
      await chrome.storage.local.set({ reo_blocked_sites: data.blocked_sites });
    }
  } catch (err) {
    console.error('[Reo] Failed to sync blocked sites:', err);
  }
}

// Sync on extension install/startup
chrome.runtime.onInstalled.addListener(() => {
  syncBlockedSites();
  // Set up periodic sync every 5 minutes
  chrome.alarms.create('syncBlockedSites', { periodInMinutes: 5 });
});

chrome.runtime.onStartup.addListener(() => {
  syncBlockedSites();
});

// Handle alarm for periodic sync
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncBlockedSites') {
    syncBlockedSites();
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
