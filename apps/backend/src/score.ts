import { supabase } from './supabase';

export interface ScoreInput {
  focusMinutes: number;
  targetMinutes: number;
  nudgesToday: number;
  maxNudges: number;
  streakDays: number;
  tasksCompleted: number;
  tasksTotal: number;
}

export interface ScoreResult {
  score: number;
  grade: string;
  breakdown: {
    focus: number;
    nudges: number;
    streak: number;
    tasks: number;
  };
}

/**
 * Task 5: Calculate daily productivity score (0-100).
 * Formula: Focus(40%) + Nudges(30%) + Streak(15%) + Tasks(15%)
 */
export function calculateScore(input: ScoreInput): ScoreResult {
  const focusScore = Math.min(input.focusMinutes / input.targetMinutes, 1) * 40;
  const nudgeScore = Math.max(1 - (input.nudgesToday / input.maxNudges), 0) * 30;
  const streakScore = Math.min(input.streakDays / 7, 1) * 15;
  const taskScore = input.tasksTotal > 0
    ? (input.tasksCompleted / input.tasksTotal) * 15
    : 7.5;

  const score = Math.round(Math.min(Math.max(focusScore + nudgeScore + streakScore + taskScore, 0), 100));

  let grade: string;
  if (score >= 90) grade = 'S';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else grade = 'D';

  return {
    score,
    grade,
    breakdown: {
      focus: Math.round(focusScore),
      nudges: Math.round(nudgeScore),
      streak: Math.round(streakScore),
      tasks: Math.round(taskScore),
    },
  };
}

/**
 * Gather today's data and calculate score for a device/user.
 */
export async function getTodayScore(deviceToken: string): Promise<ScoreResult> {
  const today = new Date().toISOString().split('T')[0];

  const [nudgeRes, sessionRes, taskRes, streakRes] = await Promise.all([
    supabase
      .from('nudge_events')
      .select('*', { count: 'exact', head: true })
      .eq('device_token', deviceToken)
      .gte('created_at', today),
    supabase
      .from('focus_sessions')
      .select('duration_minutes')
      .eq('device_token', deviceToken)
      .eq('completed', true)
      .gte('started_at', today),
    supabase
      .from('tasks')
      .select('completed')
      .eq('device_token', deviceToken),
    // Streak: last 30 days
    supabase
      .from('focus_sessions')
      .select('duration_minutes, started_at')
      .eq('device_token', deviceToken)
      .eq('completed', true)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const focusMinutes = (sessionRes.data || []).reduce((s, f) => s + (f.duration_minutes || 0), 0);
  const nudgesToday = nudgeRes.count || 0;
  const tasks = taskRes.data || [];
  const tasksCompleted = tasks.filter(t => t.completed).length;

  // Calculate streak
  const focusByDay: Record<string, number> = {};
  (streakRes.data || []).forEach(s => {
    const day = s.started_at.split('T')[0];
    focusByDay[day] = (focusByDay[day] || 0) + (s.duration_minutes || 0);
  });
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if ((focusByDay[key] || 0) > 0) streak++;
    else break;
  }

  return calculateScore({
    focusMinutes,
    targetMinutes: 120,
    nudgesToday,
    maxNudges: 20,
    streakDays: streak,
    tasksCompleted,
    tasksTotal: tasks.length,
  });
}
