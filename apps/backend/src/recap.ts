import { supabase } from './supabase';

/**
 * Phase 3 Task 7: Weekly Email Recap
 *
 * Generates a weekly productivity summary and sends it via Resend.
 * Can be triggered manually via API or via a scheduled cron job.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RECAP_FROM_EMAIL || 'Reo <reo@updates.reo.app>';

interface WeeklyRecapData {
  email: string;
  userName?: string;
  totalFocusMinutes: number;
  totalNudges: number;
  tasksCompleted: number;
  tasksCreated: number;
  streakDays: number;
  topDistractingSite: string;
  avgScoreGrade: string;
  focusSessions: number;
  weekStart: string;
  weekEnd: string;
}

/** Gather weekly stats for a user */
export async function gatherWeeklyStats(
  identifier: { userId?: string; deviceToken?: string }
): Promise<WeeklyRecapData | null> {
  const filter = identifier.userId
    ? { column: 'user_id', value: identifier.userId }
    : { column: 'device_token', value: identifier.deviceToken! };

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = weekAgo.toISOString().split('T')[0];
  const weekEnd = now.toISOString().split('T')[0];

  // Gather data in parallel
  const [sessions, nudges, tasks, settings] = await Promise.all([
    supabase
      .from('focus_sessions')
      .select('duration_minutes, completed')
      .eq(filter.column, filter.value)
      .gte('started_at', weekAgo.toISOString()),
    supabase
      .from('nudge_events')
      .select('site_url')
      .eq(filter.column, filter.value)
      .gte('created_at', weekAgo.toISOString()),
    supabase
      .from('tasks')
      .select('completed, created_at, updated_at')
      .eq(filter.column, filter.value),
    supabase
      .from('settings')
      .select('email, weekly_recap_enabled')
      .eq(identifier.deviceToken ? 'device_token' : 'user_id', identifier.deviceToken || identifier.userId!)
      .single(),
  ]);

  const email = settings.data?.email;
  if (!email || settings.data?.weekly_recap_enabled === false) {
    return null; // No email or recap disabled
  }

  const focusSessions = sessions.data || [];
  const nudgeEvents = nudges.data || [];
  const allTasks = tasks.data || [];

  const totalFocusMinutes = focusSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  // Count completed tasks this week
  const tasksCompleted = allTasks.filter(t =>
    t.completed && t.updated_at && new Date(t.updated_at) >= weekAgo
  ).length;
  const tasksCreated = allTasks.filter(t =>
    t.created_at && new Date(t.created_at) >= weekAgo
  ).length;

  // Find top distracting site
  const siteCounts: Record<string, number> = {};
  nudgeEvents.forEach(n => {
    try {
      const domain = new URL(n.site_url || '').hostname.replace('www.', '');
      siteCounts[domain] = (siteCounts[domain] || 0) + 1;
    } catch {}
  });
  const topDistractingSite = Object.entries(siteCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

  // Calculate streak (simplified — check daily summaries)
  const { data: summaries } = await supabase
    .from('daily_summaries')
    .select('summary_date, focus_minutes')
    .eq(filter.column, filter.value)
    .order('summary_date', { ascending: false })
    .limit(30);

  let streakDays = 0;
  if (summaries) {
    for (const s of summaries) {
      if ((s.focus_minutes || 0) > 0) streakDays++;
      else break;
    }
  }

  // Grade approximation
  const grades = ['F', 'D', 'C', 'B', 'A', 'S'];
  const gradeIndex = Math.min(
    Math.floor((totalFocusMinutes / 7 / 60) * 5), // avg hours/day → index
    5
  );

  return {
    email,
    totalFocusMinutes,
    totalNudges: nudgeEvents.length,
    tasksCompleted,
    tasksCreated,
    streakDays,
    topDistractingSite,
    avgScoreGrade: grades[gradeIndex] || 'C',
    focusSessions: focusSessions.length,
    weekStart,
    weekEnd,
  };
}

/** Generate the email HTML */
function generateRecapEmail(data: WeeklyRecapData): string {
  const hours = Math.floor(data.totalFocusMinutes / 60);
  const mins = data.totalFocusMinutes % 60;
  const focusStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 0; background: #F8FAFC; }
    .container { max-width: 520px; margin: 0 auto; padding: 24px 16px; }
    .card { background: white; border-radius: 12px; padding: 28px 24px; border: 1px solid #E2E8F0; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 20px; font-weight: 800; color: #0F172A; margin: 8px 0 4px; }
    .header p { font-size: 13px; color: #94A3B8; margin: 0; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .stat { background: #F8FAFC; border-radius: 8px; padding: 14px; text-align: center; }
    .stat-value { font-size: 22px; font-weight: 800; color: #2563EB; }
    .stat-label { font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    .grade { display: inline-flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 50%; background: #DBEAFE; color: #2563EB; font-size: 24px; font-weight: 800; margin: 16px 0; }
    .insight { font-size: 13px; color: #475569; line-height: 1.6; margin-bottom: 12px; }
    .insight strong { color: #0F172A; }
    .cta { display: block; text-align: center; background: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .footer { text-align: center; font-size: 11px; color: #94A3B8; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div style="font-size: 36px;">📊</div>
        <h1>Your Weekly Recap</h1>
        <p>${data.weekStart} — ${data.weekEnd}</p>
      </div>

      <div style="text-align: center;">
        <div class="grade">${data.avgScoreGrade}</div>
      </div>

      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value">${focusStr}</div>
          <div class="stat-label">Total Focus</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.focusSessions}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.tasksCompleted}</div>
          <div class="stat-label">Tasks Done</div>
        </div>
        <div class="stat">
          <div class="stat-value">${data.streakDays}</div>
          <div class="stat-label">Day Streak</div>
        </div>
      </div>

      <div class="insight">
        🎯 You completed <strong>${data.tasksCompleted}</strong> out of <strong>${data.tasksCreated}</strong> tasks this week.
      </div>
      <div class="insight">
        🚫 Reo nudged you <strong>${data.totalNudges}</strong> times. ${data.topDistractingSite !== 'None' ? `Your top distraction: <strong>${data.topDistractingSite}</strong>.` : 'No distractions detected!'}
      </div>
      <div class="insight">
        🔥 Current streak: <strong>${data.streakDays} day${data.streakDays !== 1 ? 's' : ''}</strong>.${data.streakDays >= 7 ? ' Amazing consistency!' : data.streakDays >= 3 ? ' Keep it going!' : ' Build momentum this week!'}
      </div>

      <a href="https://reo-backend-287020541953.asia-southeast2.run.app" class="cta">
        Open Reo Dashboard →
      </a>
    </div>
    <div class="footer">
      Sent by Reo • <a href="#" style="color: #94A3B8;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;
}

/** Send weekly recap email via Resend */
export async function sendWeeklyRecap(
  identifier: { userId?: string; deviceToken?: string }
): Promise<{ sent: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const data = await gatherWeeklyStats(identifier);
  if (!data) {
    return { sent: false, error: 'No email found or recap disabled' };
  }

  const html = generateRecapEmail(data);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: data.email,
        subject: `📊 Your Reo Weekly Recap (${data.weekStart} → ${data.weekEnd})`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Recap] Resend error:', err);
      return { sent: false, error: `Resend error: ${res.status}` };
    }

    console.log(`[Recap] Sent weekly recap to ${data.email}`);
    return { sent: true };
  } catch (err: any) {
    console.error('[Recap] Error:', err.message);
    return { sent: false, error: err.message };
  }
}
