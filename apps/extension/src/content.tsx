import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReoBubble } from './ReoBubble';
import { ReoBlocker } from './blocker';
import './style.css';

const DEFAULT_BLOCKED_SITES = ['youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'reddit.com'];

// Listen for token sync from dashboard page
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REO_SYNC_TOKEN' && event.data.token) {
    chrome.storage.local.set({ reo_device_token: event.data.token }, () => {
      console.log('[Reo] Synced device token from web app:', event.data.token);
    });
  }
});

function init() {
  const url = window.location.hostname.replace('www.', '');

  // If on Reo's own dashboard, inject token sniffer script
  if (url.includes('run.app') || url.includes('localhost')) {
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const token = localStorage.getItem('reo_device_token');
        if (token) {
          window.postMessage({ type: 'REO_SYNC_TOKEN', token }, '*');
        }
      })();
    `;
    document.documentElement.appendChild(script);
    script.remove();
  }

  // Ensure body exists before appending
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => init());
    return;
  }

  // Prevent multiple injections
  if (document.getElementById('reo-root')) return;

  const container = document.createElement('div');
  container.id = 'reo-root';
  document.body.appendChild(container);

  const root = createRoot(container);

  // Check if we should show the full blocker (focus session active + blocking enabled + on a blocked site)
  function checkAndRender() {
    const url = window.location.hostname.replace('www.', '');

    // Never block Reo's own dashboard or productive sites
    const whitelist = ['run.app', 'localhost', 'github.com', 'docs.google.com', 'drive.google.com',
      'notion.so', 'figma.com', 'stackoverflow.com', 'gitlab.com', 'supabase.com'];
    const isWhitelisted = whitelist.some(s => url.includes(s));
    if (isWhitelisted) {
      root.render(<ReoBubble />);
      return;
    }

    chrome.storage.local.get(
      ['focus_active', 'block_mode_enabled', 'reo_blocked_sites', 'reo_focus_task', 'reo_session_whitelist'],
      (result) => {
        const focusActive = result.focus_active === true;
        const blockMode = result.block_mode_enabled === true;
        const blockedSites: string[] = (result.reo_blocked_sites && Array.isArray(result.reo_blocked_sites))
          ? result.reo_blocked_sites
          : DEFAULT_BLOCKED_SITES;
        const task = result.reo_focus_task || '';
        const sessionWhitelist: string[] = result.reo_session_whitelist || [];

        const isBlocked = blockedSites.some(s => url.includes(s));
        const isSessionWhitelisted = sessionWhitelist.some(s => url.includes(s));

        if (focusActive && blockMode && isBlocked && !isSessionWhitelisted) {
          // Show full-page blocker
          root.render(
            <ReoBlocker
              task={task}
              onDismiss={() => {
                // Add domain to session whitelist
                const domain = window.location.hostname.replace('www.', '');
                chrome.storage.local.get('reo_session_whitelist', (r) => {
                  const list = r.reo_session_whitelist || [];
                  list.push(domain);
                  chrome.storage.local.set({ reo_session_whitelist: list });
                });
                // Switch to bubble mode
                root.render(<ReoBubble />);
              }}
              onGoBack={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = 'about:blank';
                }
              }}
            />
          );
        } else {
          // Normal bubble mode
          root.render(<ReoBubble />);
        }
      }
    );
  }

  checkAndRender();
}

init();
