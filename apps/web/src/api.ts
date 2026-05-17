const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3333'
  : 'https://reo-backend-287020541953.us-central1.run.app';

function getDeviceToken(): string {
  let token = localStorage.getItem('reo_device_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('reo_device_token', token);
  }
  return token;
}

async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-device-token': getDeviceToken(),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const reoApi = {
  register: () => api('/api/reo/device/register', {
    method: 'POST',
    body: JSON.stringify({ device_token: getDeviceToken() }),
  }),

  getState: () => api('/api/reo/state'),

  saveState: (data: { persona?: string; task?: string; blocked_sites?: string[] }) =>
    api('/api/reo/state', { method: 'POST', body: JSON.stringify(data) }),

  chat: (message: string) =>
    api<{ message: string }>('/api/reo/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  nudge: (data: { site_url: string; time_on_site_seconds: number; escalation_level: number }) =>
    api<{ message: string; escalation_level: number }>('/api/reo/nudge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStats: (range = '7d') => api('/api/reo/stats?range=' + range),

  startFocus: (task?: string) =>
    api<{ session_id: string; task: string }>('/api/reo/focus/start', {
      method: 'POST',
      body: JSON.stringify({ task }),
    }),

  endFocus: (session_id: string, completed = true) =>
    api<{ duration_minutes: number; completed: boolean }>('/api/reo/focus/end', {
      method: 'POST',
      body: JSON.stringify({ session_id, completed }),
    }),

  getDailySummary: () => api('/api/reo/summary/today'),
};

export { getDeviceToken };
