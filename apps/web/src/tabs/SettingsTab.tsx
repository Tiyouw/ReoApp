import React, { useState, useEffect } from 'react';
import { reoApi } from '../api';
import { icons } from '../icons';

export function SettingsTab({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'default' | 'granted' | 'denied'>('default');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedSites, setBlockedSites] = useState<string[]>([]);
  const [newSite, setNewSite] = useState('');
  const [savingSites, setSavingSites] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check push notification support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPushStatus('unsupported');
    } else {
      setPushStatus(Notification.permission as any);
      setPushEnabled(Notification.permission === 'granted');
    }

    // Load settings
    reoApi.getState().then(data => {
      setBlockedSites(data.blocked_sites || ['youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'reddit.com']);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Push notification toggle
  const handlePushToggle = async () => {
    if (pushStatus === 'unsupported') {
      showToast('Push notifications are not supported in this browser', 'error');
      return;
    }

    if (pushStatus === 'denied') {
      showToast('Notifications blocked. Please enable in browser settings.', 'error');
      return;
    }

    try {
      if (!pushEnabled) {
        const permission = await Notification.requestPermission();
        setPushStatus(permission as any);
        if (permission === 'granted') {
          // Register service worker and subscribe
          const reg = await navigator.serviceWorker.register('/sw.js');
          const vapidKey = await reoApi.getVapidKey();
          if (vapidKey) {
            const subscription = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: vapidKey,
            });
            await reoApi.pushSubscribe(subscription.toJSON());
          }
          setPushEnabled(true);
          showToast('Notifications enabled! You\'ll get streak reminders.');
        } else {
          showToast('Notification permission denied', 'error');
        }
      } else {
        // Unsubscribe
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await reoApi.pushUnsubscribe(sub.endpoint);
          await sub.unsubscribe();
        }
        setPushEnabled(false);
        showToast('Notifications disabled');
      }
    } catch (err) {
      showToast('Failed to toggle notifications', 'error');
    }
  };

  // Data export
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await reoApi.exportData(exportFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `reo-export-${today}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Data exported as ${exportFormat.toUpperCase()}`);
    } catch {
      showToast('Export failed. Try again later.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Delete all data
  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      await reoApi.deleteAllData();
      showToast('All data deleted. Starting fresh.');
      setConfirmDelete(false);
      // Reset local state
      localStorage.removeItem('reo_device_token');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      showToast('Failed to delete data', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Blocked sites management
  const addSite = () => {
    const site = newSite.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    if (!site) return;
    if (blockedSites.includes(site)) {
      showToast('Site already in the list', 'error');
      return;
    }
    setBlockedSites(prev => [...prev, site]);
    setNewSite('');
  };

  const removeSite = (site: string) => {
    setBlockedSites(prev => prev.filter(s => s !== site));
  };

  const saveBlockedSites = async () => {
    setSavingSites(true);
    try {
      await reoApi.saveState({ blocked_sites: blockedSites });
      showToast('Blocked sites updated — extension will sync in 5 min');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSavingSites(false);
    }
  };

  if (loading) {
    return <div className="flex flex-col gap-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton" />)}
    </div>;
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      {/* Notifications */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="feature-icon bg-[#FFF7ED] text-[#EA580C]">{icons.bell}</div>
          <div>
            <h2 className="text-sm font-bold">Push Notifications</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Get streak reminders and off-task alerts
            </p>
          </div>
          <button
            type="button"
            onClick={handlePushToggle}
            className={`ml-auto relative w-11 h-6 rounded-full transition-colors duration-200 ${
              pushEnabled ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'
            }`}
            role="switch"
            aria-checked={pushEnabled}
            aria-label="Toggle push notifications"
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              pushEnabled ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {pushStatus === 'unsupported' && <>{icons.bellOff} Not supported in this browser</>}
          {pushStatus === 'denied' && <>{icons.bellOff} Blocked — enable in browser settings</>}
          {pushStatus === 'default' && <>{icons.bell} Click toggle to enable</>}
          {pushStatus === 'granted' && <>{icons.bell} {pushEnabled ? 'Enabled ✓' : 'Disabled — toggle to re-enable'}</>}
        </div>
      </div>

      {/* Blocked Sites */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="feature-icon bg-[#FEF2F2] text-[#DC2626]">{icons.shield}</div>
          <div>
            <h2 className="text-sm font-bold">Blocked Sites</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Sites that trigger Reo's nudges
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <input type="text" value={newSite} onChange={e => setNewSite(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSite(); } }}
            placeholder="e.g. facebook.com" className="input-field flex-1 text-sm" autoComplete="off" />
          <button type="button" onClick={addSite} disabled={!newSite.trim()}
            className="btn-primary px-3 text-sm" aria-label="Add site">
            {icons.plus}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {blockedSites.map(site => (
            <span key={site} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#DC2626]">
              {site}
              <button type="button" onClick={() => removeSite(site)} className="hover:text-[#991B1B]" aria-label={`Remove ${site}`}>
                {icons.x}
              </button>
            </span>
          ))}
        </div>

        <button type="button" onClick={saveBlockedSites} disabled={savingSites}
          className="btn-primary text-sm w-full">
          {savingSites ? <>{icons.loader} Saving…</> : 'Save Blocked Sites'}
        </button>
      </div>

      {/* Data Export */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="feature-icon bg-[#DBEAFE] text-[#2563EB]">{icons.download}</div>
          <div>
            <h2 className="text-sm font-bold">Export Your Data</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Download all your tasks, stats, and chat history
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={exportFormat}
            onChange={e => setExportFormat(e.target.value as 'json' | 'csv')}
            className="input-field text-sm flex-1"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button type="button" onClick={handleExport} disabled={exporting}
            className="btn-primary text-sm px-4">
            {exporting ? <>{icons.loader} Exporting…</> : <>{icons.download} Export</>}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: '#FCA5A5' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="feature-icon bg-[#FEF2F2] text-[#DC2626]">{icons.trash}</div>
          <div>
            <h2 className="text-sm font-bold text-[#DC2626]">Danger Zone</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Permanently delete all your data
            </p>
          </div>
        </div>

        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="w-full text-sm font-semibold px-4 py-2.5 rounded-lg border-2 border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors">
            Delete All My Data
          </button>
        ) : (
          <div className="bg-[#FEF2F2] rounded-lg p-4">
            <p className="text-xs text-[#DC2626] font-medium mb-3">
              ⚠️ This will permanently delete all your tasks, chat history, focus sessions, and stats. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg bg-white border hover:bg-[#F1F5F9] transition-colors"
                style={{ borderColor: 'var(--color-border)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteData} disabled={deleting}
                className="flex-1 text-sm font-semibold px-4 py-2 rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors">
                {deleting ? <>{icons.loader} Deleting…</> : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
