import express from 'express';
import cors from 'cors';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';
import { requireDeviceToken, authenticateUser } from './middleware';
import { exportUserData } from './export';
import { saveSubscription, removeSubscription, sendPushToDevice, getVapidPublicKey } from './push';

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/* ── Persona helpers ── */
function getPersonaDesc(persona: string): string {
  if (persona === 'jowo') return 'You speak in funny, angry Javanese Indonesian slang. Be dramatic and guilt-trip with humor.';
  if (persona === 'jaksel') return 'You speak in sassy South Jakarta slang (Indonesian-English mix, lots of "literally", "which is", "I mean").';
  return 'You speak politely, professionally, and straight to the point.';
}

/* ── Strip markdown from AI responses ── */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')      // italic
    .replace(/_(.+?)_/g, '$1')        // underscore italic
    .replace(/`(.+?)`/g, '$1')        // inline code
    .replace(/^#+\s*/gm, '')          // headings
    .replace(/^[\-\*]\s+/gm, '• ')   // list bullets
    .trim();
}

/* ── Register device ── */
app.post('/api/reo/device/register', async (req, res) => {
  const { device_token } = req.body;
  if (!device_token) return res.status(400).json({ error: 'device_token required' });

  const { data: existing } = await supabase
    .from('settings')
    .select('*')
    .eq('device_token', device_token)
    .single();

  if (existing) return res.json(existing);

  const { data, error } = await supabase
    .from('settings')
    .insert({ device_token })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* ── Get state ── */
app.get('/api/reo/state', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('device_token', token)
    .single();

  if (!data) return res.json({ persona: 'jowo', task: '', blocked_sites: ['youtube.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'reddit.com'] });
  res.json(data);
});

/* ── Update state ── */
app.post('/api/reo/state', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (req.body.persona) updates.persona = req.body.persona;
  if (req.body.task !== undefined) updates.task = req.body.task;
  if (req.body.blocked_sites) updates.blocked_sites = req.body.blocked_sites;

  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('device_token', token)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, state: data });
});

/* ── Chat (Task 5: persist messages) ── */
app.post('/api/reo/chat', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { message } = req.body;

  const { data: settings } = await supabase
    .from('settings')
    .select('persona, task')
    .eq('device_token', token)
    .single();

  const persona = settings?.persona || 'jowo';
  const task = settings?.task || 'nothing specific';
  const userMessage = message || req.body.context || '';

  // Persist user message
  await supabase.from('chat_messages').insert({
    device_token: token,
    role: 'user',
    content: userMessage,
  });

  // Fetch last 10 messages for conversation context
  const { data: recentMessages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('device_token', token)
    .order('created_at', { ascending: false })
    .limit(10);

  const conversationContext = (recentMessages || [])
    .reverse()
    .map(m => `${m.role === 'user' ? 'User' : 'Reo'}: ${m.content}`)
    .join('\n');

  const prompt = `You are Reo, a productivity companion. ${getPersonaDesc(persona)}
The user is working on: "${task}".
${conversationContext ? `Recent conversation:\n${conversationContext}\n` : ''}User says: "${userMessage}"
Respond in 1-3 sentences matching your persona. Do NOT use any markdown formatting — no asterisks, no bold, no lists. Plain text only.`;

  let aiResponse: string;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    aiResponse = stripMarkdown(result.response.text());
  } catch (error: any) {
    console.error('Chat AI error:', error.message);
    const fallbacks: Record<string, string> = {
      jowo: `Waduh, otak AI-ku lagi error! Tapi inget ya, "${task}" kudu rampung. Ayo kerja!`,
      jaksel: `Gue lagi nge-lag nih literally. But seriously, "${task}" harus beres ya bestie~`,
      professional: `I'm experiencing a temporary issue. Please continue working on "${task}" — I'll be back shortly.`,
    };
    aiResponse = fallbacks[persona] || fallbacks.jowo;
  }

  // Persist assistant message
  await supabase.from('chat_messages').insert({
    device_token: token,
    role: 'assistant',
    content: aiResponse,
  });

  res.json({ message: aiResponse });
});

/* ── Chat history (Task 5) ── */
app.get('/api/reo/chat/history', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const limit = parseInt(req.query.limit as string) || 50;

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('device_token', token)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

/* ── Nudge (Task 3: server-side 60s debounce) ── */
app.post('/api/reo/nudge', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { site_url, time_on_site_seconds, escalation_level } = req.body;

  let domain: string;
  try {
    domain = new URL(site_url).hostname.replace('www.', '');
  } catch {
    domain = site_url || 'unknown';
  }

  // Task 3: Server-side debounce — check if last nudge for same domain was <60s ago
  const { data: recentNudge } = await supabase
    .from('nudge_events')
    .select('ai_message, created_at')
    .eq('device_token', token)
    .eq('site_domain', domain)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recentNudge) {
    const lastNudgeAge = Date.now() - new Date(recentNudge.created_at).getTime();
    if (lastNudgeAge < 60000) {
      return res.json({
        message: recentNudge.ai_message,
        escalation_level: escalation_level || 0,
        cached: true,
      });
    }
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('persona, task')
    .eq('device_token', token)
    .single();

  const persona = settings?.persona || 'jowo';
  const task = settings?.task || 'nothing specific';
  const level = escalation_level || 0;
  const levelLabel = ['gentle', 'firm', 'savage'][level] || 'gentle';

  // Count today's nudges
  const today = new Date().toISOString().split('T')[0];
  const { count: todayNudges } = await supabase
    .from('nudge_events')
    .select('*', { count: 'exact', head: true })
    .eq('device_token', token)
    .gte('created_at', today);

  const prompt = `You are Reo, a productivity companion. ${getPersonaDesc(persona)}
Escalation level: ${levelLabel} — ${level === 0 ? 'be gentle and friendly' : level === 1 ? 'be firm and direct' : 'go FULL savage, maximum guilt trip'}.
User task: "${task}". They are on ${domain} for ${time_on_site_seconds || 0} seconds.
They have been nudged ${todayNudges || 0} times today already.
Give a ${level === 2 ? '2-3' : '1-2'} sentence reprimand in character. Do NOT use any markdown formatting — no asterisks, no bold, no lists. Plain text only.`;

  let aiMessage: string;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    aiMessage = stripMarkdown(result.response.text());
  } catch {
    aiMessage = `Heh! "${task}" belum selesai, malah buka ${domain}. Balik kerja!`;
  }

  // Log the nudge
  await supabase.from('nudge_events').insert({
    device_token: token,
    site_url: site_url || `https://${domain}`,
    site_domain: domain,
    persona,
    escalation_level: level,
    ai_message: aiMessage,
    time_on_site_seconds: time_on_site_seconds || 0,
  });

  res.json({ message: aiMessage, escalation_level: level });
});

/* ── Stats (Task 6: fix streak calculation) ── */
app.get('/api/reo/stats', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const range = (req.query.range as string) || '7d';
  const days = parseInt(range) || 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: nudges } = await supabase
    .from('nudge_events')
    .select('created_at, site_domain')
    .eq('device_token', token)
    .gte('created_at', since.toISOString());

  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('duration_minutes, completed, started_at')
    .eq('device_token', token)
    .eq('completed', true)
    .gte('started_at', since.toISOString());

  // Nudges by day
  const nudgesByDay: Record<string, number> = {};
  (nudges || []).forEach(n => {
    const day = n.created_at.split('T')[0];
    nudgesByDay[day] = (nudgesByDay[day] || 0) + 1;
  });

  // Top sites
  const siteCounts: Record<string, number> = {};
  (nudges || []).forEach(n => {
    siteCounts[n.site_domain] = (siteCounts[n.site_domain] || 0) + 1;
  });
  const topSites = Object.entries(siteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));

  // Total focus minutes
  const totalFocusMin = (sessions || []).reduce((s, f) => s + (f.duration_minutes || 0), 0);

  // Task 6: Fixed streak — only count days with actual focus time (>0 minutes)
  // Fetch 30 days of sessions for streak calculation
  const streakSince = new Date();
  streakSince.setDate(streakSince.getDate() - 30);
  const { data: streakSessions } = await supabase
    .from('focus_sessions')
    .select('duration_minutes, started_at')
    .eq('device_token', token)
    .eq('completed', true)
    .gte('started_at', streakSince.toISOString());

  // Build a map of focus minutes per day
  const focusByDay: Record<string, number> = {};
  (streakSessions || []).forEach(s => {
    const day = s.started_at.split('T')[0];
    focusByDay[day] = (focusByDay[day] || 0) + (s.duration_minutes || 0);
  });

  let streak = 0;
  const todayDate = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dayFocus = focusByDay[key] || 0;
    if (dayFocus > 0) {
      streak++;
    } else {
      break; // Streak broken — no focus time this day
    }
  }

  res.json({
    total_nudges: (nudges || []).length,
    total_focus_minutes: totalFocusMin,
    streak_days: streak,
    nudges_by_day: nudgesByDay,
    top_sites: topSites,
  });
});

/* ── Task CRUD (Task 4: persist tasks to Supabase) ── */
app.get('/api/reo/tasks', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('device_token', token)
    .order('position', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/reo/tasks', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  // Get max position
  const { data: existing } = await supabase
    .from('tasks')
    .select('position')
    .eq('device_token', token)
    .order('position', { ascending: false })
    .limit(1);

  const nextPos = existing && existing.length > 0 ? (existing[0].position || 0) + 1 : 0;

  const { data, error } = await supabase
    .from('tasks')
    .insert({ device_token: token, title, position: nextPos })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/reo/tasks/:id', requireDeviceToken, async (req, res) => {
  const { id } = req.params;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.completed !== undefined) updates.completed = req.body.completed;
  if (req.body.position !== undefined) updates.position = req.body.position;

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/reo/tasks/:id', requireDeviceToken, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/* ── Focus start ── */
app.post('/api/reo/focus/start', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { data: settings } = await supabase
    .from('settings')
    .select('task')
    .eq('device_token', token)
    .single();

  const { data, error } = await supabase
    .from('focus_sessions')
    .insert({
      device_token: token,
      task: req.body.task || settings?.task || 'Focus session',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ session_id: data.id, task: data.task });
});

/* ── Focus end ── */
app.post('/api/reo/focus/end', requireDeviceToken, async (req, res) => {
  const { session_id, completed } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const now = new Date();
  const { data: session } = await supabase
    .from('focus_sessions')
    .select('started_at')
    .eq('id', session_id)
    .single();

  if (!session) return res.status(404).json({ error: 'Session not found' });

  const duration = Math.round((now.getTime() - new Date(session.started_at).getTime()) / 60000);

  const { error } = await supabase
    .from('focus_sessions')
    .update({
      ended_at: now.toISOString(),
      duration_minutes: duration,
      completed: completed !== false,
    })
    .eq('id', session_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ duration_minutes: duration, completed: completed !== false });
});

/* ── Daily summary (Task 8: staleness check + auto-refresh) ── */
app.get('/api/reo/summary/today', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const today = new Date().toISOString().split('T')[0];
  const forceRefresh = req.query.refresh === 'true';

  // Check for existing summary (skip if refreshing)
  if (!forceRefresh) {
    const { data: existing } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('device_token', token)
      .eq('summary_date', today)
      .single();

    if (existing?.ai_summary) {
      // Task 8: Check staleness — regenerate if summary is >2 hours old AND new data exists
      const summaryAge = Date.now() - new Date(existing.updated_at || existing.created_at || 0).getTime();
      const twoHours = 2 * 60 * 60 * 1000;

      if (summaryAge < twoHours) {
        existing.ai_summary = stripMarkdown(existing.ai_summary);
        return res.json(existing);
      }

      // Check if new events exist since summary was generated
      const { count: newNudges } = await supabase
        .from('nudge_events')
        .select('*', { count: 'exact', head: true })
        .eq('device_token', token)
        .gte('created_at', existing.updated_at || existing.created_at);

      const { count: newSessions } = await supabase
        .from('focus_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('device_token', token)
        .eq('completed', true)
        .gte('started_at', existing.updated_at || existing.created_at);

      if ((newNudges || 0) === 0 && (newSessions || 0) === 0) {
        // No new data — return cached summary
        existing.ai_summary = stripMarkdown(existing.ai_summary);
        return res.json(existing);
      }
      // Stale + new data exists → fall through to regenerate
    }
  }

  // Gather today's data
  const { data: nudges } = await supabase
    .from('nudge_events')
    .select('site_domain')
    .eq('device_token', token)
    .gte('created_at', today);

  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('duration_minutes, task')
    .eq('device_token', token)
    .eq('completed', true)
    .gte('started_at', today);

  const { data: settings } = await supabase
    .from('settings')
    .select('persona, task')
    .eq('device_token', token)
    .single();

  const totalNudges = (nudges || []).length;
  const totalFocus = (sessions || []).reduce((s, f) => s + (f.duration_minutes || 0), 0);

  if (totalNudges === 0 && totalFocus === 0) {
    return res.json({ summary_date: today, total_nudges: 0, total_focus_minutes: 0, ai_summary: null });
  }

  // Top sites (filter out Reo's own URLs)
  const siteCounts: Record<string, number> = {};
  (nudges || []).forEach(n => {
    if (n.site_domain && !n.site_domain.includes('run.app') && !n.site_domain.includes('localhost')) {
      siteCounts[n.site_domain] = (siteCounts[n.site_domain] || 0) + 1;
    }
  });
  const topSites = Object.entries(siteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const personaStyle = settings?.persona === 'jowo' ? 'Javanese tough love style'
    : settings?.persona === 'jaksel' ? 'South Jakarta sassy slang' : 'professional and polite';

  const prompt = `You are Reo. Write a brief daily productivity summary in ${personaStyle} style.
Stats: ${totalNudges} nudges, ${totalFocus} min focused, top sites: ${topSites.map(s => s[0]).join(', ') || 'none'}.
Task: "${settings?.task || 'general'}". Keep it 2-4 sentences, encouraging but honest. Do NOT use any markdown formatting — no asterisks, no bold, no lists. Plain text only.`;

  let aiSummary: string;
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    aiSummary = stripMarkdown(result.response.text());
  } catch {
    aiSummary = `Today: ${totalNudges} nudges, ${totalFocus} min focused. Keep going!`;
  }

  const { data: summary } = await supabase
    .from('daily_summaries')
    .upsert({
      device_token: token,
      summary_date: today,
      total_nudges: totalNudges,
      total_focus_minutes: totalFocus,
      top_distracting_sites: topSites,
      ai_summary: aiSummary,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  res.json(summary);
});

/* ── Auth: magic link login ── */
app.post('/api/reo/auth/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: 'Check your email for a magic link!' });
});

/* ── Auth: link device to user ── */
app.post('/api/reo/auth/link-device', authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const deviceToken = req.body.device_token || (req as any).deviceToken;

  if (!userId) return res.status(401).json({ error: 'JWT auth required to link device' });
  if (!deviceToken) return res.status(400).json({ error: 'device_token required' });

  const tables = ['settings', 'nudge_events', 'focus_sessions', 'daily_summaries', 'tasks', 'chat_messages'];
  let linked = 0;

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .update({ user_id: userId })
      .eq('device_token', deviceToken)
      .select('*', { count: 'exact', head: true });
    linked += count || 0;
  }

  res.json({ linked, message: `Linked ${linked} records to your account` });
});

/* ── Auth: get current user ── */
app.get('/api/reo/auth/me', authenticateUser, async (req, res) => {
  const userId = (req as any).userId;
  const email = (req as any).userEmail;

  if (userId) {
    return res.json({ id: userId, email });
  }
  res.json(null);
});

/* ── Push: get VAPID key ── */
app.get('/api/reo/push/vapid-key', (req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(404).json({ error: 'Push not configured' });
  res.json(key);
});

/* ── Push: subscribe ── */
app.post('/api/reo/push/subscribe', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription required' });

  const saved = await saveSubscription(token, subscription);
  res.json({ success: saved });
});

/* ── Push: unsubscribe ── */
app.delete('/api/reo/push/unsubscribe', requireDeviceToken, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  await removeSubscription(endpoint);
  res.json({ success: true });
});

/* ── Push: test ── */
app.post('/api/reo/push/test', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  await sendPushToDevice(token, {
    title: 'Reo Test Notification',
    body: 'Push notifications are working! 🎉',
  });
  res.json({ success: true });
});

/* ── Export data ── */
app.get('/api/reo/export', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const userId = (req as any).userId;
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await exportUserData(
      { userId, deviceToken: token },
      format
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="reo-export-${today}.${format}"`);
    res.send(result.body);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Delete all account data ── */
app.delete('/api/reo/account/data', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;

  // Delete in order (foreign key safety)
  const tables = ['chat_messages', 'tasks', 'daily_summaries', 'nudge_events', 'focus_sessions', 'push_subscriptions', 'settings'];

  for (const table of tables) {
    await supabase.from(table).delete().eq('device_token', token);
  }

  res.json({ success: true, message: 'All data deleted' });
});

/* ── Serve web frontend (production) ── */
const webDistPath = path.join(__dirname, '..', '..', 'web', 'dist');
app.use(express.static(webDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(webDistPath, 'index.html'));
});

/* ── Start server ── */
const PORT = process.env.PORT || 3333;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Reo backend running on port ${PORT}`));
}

export default app;
