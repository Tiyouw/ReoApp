import express from 'express';
import cors from 'cors';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';
import { requireDeviceToken } from './middleware';

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

/* ── Chat ── */
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

  const prompt = `You are Reo, a productivity companion. ${getPersonaDesc(persona)}
The user is working on: "${task}".
User says: "${message || req.body.context || ''}"
Respond in 1-3 sentences matching your persona. Do NOT use any markdown formatting — no asterisks, no bold, no lists. Plain text only.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    res.json({ message: stripMarkdown(result.response.text()) });
  } catch (error: any) {
    console.error('Chat AI error:', error.message);
    const fallbacks: Record<string, string> = {
      jowo: `Waduh, otak AI-ku lagi error! Tapi inget ya, "${task}" kudu rampung. Ayo kerja!`,
      jaksel: `Gue lagi nge-lag nih literally. But seriously, "${task}" harus beres ya bestie~`,
      professional: `I'm experiencing a temporary issue. Please continue working on "${task}" — I'll be back shortly.`,
    };
    res.json({ message: fallbacks[persona] || fallbacks.jowo });
  }
});

/* ── Nudge (log + AI response) ── */
app.post('/api/reo/nudge', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const { site_url, time_on_site_seconds, escalation_level } = req.body;

  let domain: string;
  try {
    domain = new URL(site_url).hostname.replace('www.', '');
  } catch {
    domain = site_url || 'unknown';
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

/* ── Stats ── */
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

  // Streak: consecutive days with at least 1 focus session
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const hasFocus = (sessions || []).some(s => s.started_at.startsWith(key));
    if (hasFocus || i === 0) streak++;
    else break;
  }

  res.json({
    total_nudges: (nudges || []).length,
    total_focus_minutes: totalFocusMin,
    streak_days: streak,
    nudges_by_day: nudgesByDay,
    top_sites: topSites,
  });
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

/* ── Daily summary ── */
app.get('/api/reo/summary/today', requireDeviceToken, async (req, res) => {
  const token = (req as any).deviceToken;
  const today = new Date().toISOString().split('T')[0];

  // Check for existing summary
  const { data: existing } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('device_token', token)
    .eq('summary_date', today)
    .single();

  if (existing?.ai_summary) return res.json(existing);

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

  // Top sites
  const siteCounts: Record<string, number> = {};
  (nudges || []).forEach(n => {
    siteCounts[n.site_domain] = (siteCounts[n.site_domain] || 0) + 1;
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
    })
    .select()
    .single();

  res.json(summary);
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
