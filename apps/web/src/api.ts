const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3333'
  : '';

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

  // Add JWT if available
  const jwt = localStorage.getItem('reo_jwt');
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ── Task types ── */
export interface Task {
  id: string;
  device_token: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

/* ── Chat message type ── */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const reoApi = {
  register: () => api('/api/reo/device/register', {
    method: 'POST',
    body: JSON.stringify({ device_token: getDeviceToken() }),
  }),

  getState: () => api('/api/reo/state'),

  saveState: (data: { persona?: string; task?: string; blocked_sites?: string[]; focus_active?: boolean; focus_task?: string; block_mode_enabled?: boolean }) =>
    api('/api/reo/state', { method: 'POST', body: JSON.stringify(data) }),

  chat: (message: string) =>
    api<{ message: string }>('/api/reo/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  getChatHistory: (limit = 50) =>
    api<ChatMessage[]>(`/api/reo/chat/history?limit=${limit}`),

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

  getDailySummary: (refresh = false) => api('/api/reo/summary/today' + (refresh ? '?refresh=true' : '')),

  /* Task CRUD */
  getTasks: () => api<Task[]>('/api/reo/tasks'),

  createTask: (title: string) =>
    api<Task>('/api/reo/tasks', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'completed' | 'position'>>) =>
    api<Task>(`/api/reo/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteTask: (id: string) =>
    api<{ success: boolean }>(`/api/reo/tasks/${id}`, {
      method: 'DELETE',
    }),

  /* ── Phase 2: Auth ── */
  authLogin: (email: string) =>
    api<{ success: boolean }>('/api/reo/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  authLinkDevice: () =>
    api<{ linked: number }>('/api/reo/auth/link-device', {
      method: 'POST',
      body: JSON.stringify({ device_token: getDeviceToken() }),
    }),

  authMe: () => api<{ id: string; email: string } | null>('/api/reo/auth/me'),

  /* ── Phase 2: Push ── */
  getVapidKey: () =>
    api<string>('/api/reo/push/vapid-key').catch(() => null),

  pushSubscribe: (subscription: any) =>
    api('/api/reo/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    }),

  pushUnsubscribe: (endpoint: string) =>
    api('/api/reo/push/unsubscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    }),

  pushTest: () =>
    api('/api/reo/push/test', { method: 'POST' }),

  /* ── Phase 2: Export ── */
  exportData: async (format: 'json' | 'csv' = 'json') => {
    const headers: Record<string, string> = {
      'x-device-token': getDeviceToken(),
    };
    const jwt = localStorage.getItem('reo_jwt');
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    const res = await fetch(`${API_BASE}/api/reo/export?format=${format}`, { headers });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.blob();
  },

  /* ── Phase 2: Delete Account Data ── */
  deleteAllData: () =>
    api<{ success: boolean }>('/api/reo/account/data', {
      method: 'DELETE',
    }),

  /* ── Phase 3: Smart Whitelisting ── */
  classify: (url: string, pageTitle: string) =>
    api<{ productive: boolean; reason: string; confidence: number }>('/api/reo/classify', {
      method: 'POST',
      body: JSON.stringify({ url, page_title: pageTitle }),
    }),

  classifyFeedback: (domain: string) =>
    api('/api/reo/classify/feedback', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    }),

  /* ── Phase 3: Productivity Score ── */
  getScore: () =>
    api<{ score: number; grade: string; breakdown: { focus: number; nudges: number; streak: number; tasks: number } }>('/api/reo/score/today'),

  /* ── Phase 3: Weekly Recap ── */
  sendWeeklyRecap: () =>
    api<{ success: boolean; error?: string }>('/api/reo/recap/weekly', { method: 'POST' }),
};

/* ── Auth helpers ── */
export function getJwt(): string | null {
  return localStorage.getItem('reo_jwt');
}

export function setJwt(jwt: string): void {
  localStorage.setItem('reo_jwt', jwt);
}

export function clearJwt(): void {
  localStorage.removeItem('reo_jwt');
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('reo_jwt');
}

export { getDeviceToken };
