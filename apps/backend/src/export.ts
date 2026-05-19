import { supabase } from './supabase';

/**
 * Export user data as JSON or CSV.
 */
export async function exportUserData(
  identifier: { userId?: string; deviceToken?: string },
  format: 'json' | 'csv'
) {
  const filter = identifier.userId
    ? { column: 'user_id', value: identifier.userId }
    : { column: 'device_token', value: identifier.deviceToken! };

  // For settings, device_token is always the key
  const settingsFilter = identifier.deviceToken
    ? { column: 'device_token', value: identifier.deviceToken }
    : filter;

  const [settings, tasks, nudges, sessions, summaries, messages] = await Promise.all([
    supabase.from('settings').select('*').eq(settingsFilter.column, settingsFilter.value),
    supabase.from('tasks').select('*').eq(filter.column, filter.value).order('position'),
    supabase.from('nudge_events').select('*').eq(filter.column, filter.value).order('created_at'),
    supabase.from('focus_sessions').select('*').eq(filter.column, filter.value).order('started_at'),
    supabase.from('daily_summaries').select('*').eq(filter.column, filter.value).order('summary_date'),
    supabase.from('chat_messages').select('*').eq(filter.column, filter.value).order('created_at'),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    settings: settings.data || [],
    tasks: tasks.data || [],
    nudge_events: nudges.data || [],
    focus_sessions: sessions.data || [],
    daily_summaries: summaries.data || [],
    chat_messages: messages.data || [],
  };

  if (format === 'json') {
    return {
      contentType: 'application/json',
      body: JSON.stringify(data, null, 2),
    };
  }

  // CSV format — one big CSV with section headers
  const lines: string[] = [];
  for (const [tableName, rows] of Object.entries(data)) {
    if (tableName === 'exported_at') continue;
    const tableRows = rows as Record<string, unknown>[];
    if (!tableRows.length) continue;

    lines.push(`\n# ${tableName}`);
    const cols = Object.keys(tableRows[0]);
    lines.push(cols.join(','));
    for (const row of tableRows) {
      lines.push(cols.map(c => {
        const val = row[c];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Escape CSV fields with commas or quotes
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(','));
    }
  }

  return {
    contentType: 'text/csv',
    body: lines.join('\n'),
  };
}
