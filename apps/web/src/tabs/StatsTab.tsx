import React, { useState, useEffect } from 'react';
import { reoApi } from '../api';
import { icons } from '../icons';

interface Stats {
  total_nudges: number;
  total_focus_minutes: number;
  streak_days: number;
  nudges_by_day: Record<string, number>;
  top_sites: { domain: string; count: number }[];
}

interface DailySummary {
  summary_date: string;
  total_nudges: number;
  total_focus_minutes: number;
  ai_summary: string | null;
}

/* Inline SVG bar chart */
function BarChart({ data }: { data: Record<string, number> }) {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  const values = days.map(d => data[d] || 0);
  const max = Math.max(...values, 1);
  const barW = 32;
  const gap = 8;
  const chartH = 120;
  const width = days.length * (barW + gap);

  return (
    <svg width="100%" height={chartH + 24} viewBox={`0 0 ${width} ${chartH + 24}`} aria-label="Nudges per day bar chart">
      {days.map((day, i) => {
        const val = values[i];
        const h = (val / max) * chartH;
        const x = i * (barW + gap);
        const dayLabel = new Date(day + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
        return (
          <g key={day}>
            <rect x={x} y={chartH - h} width={barW} height={h} rx={4} fill={val > 0 ? '#3B82F6' : '#E2E8F0'} />
            {val > 0 && (
              <text x={x + barW / 2} y={chartH - h - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#2563EB">{val}</text>
            )}
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize="10" fill="#94A3B8">{dayLabel}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reoApi.getStats('7d').catch(() => null),
      reoApi.getDailySummary().catch(() => null),
    ]).then(([s, d]) => {
      setStats(s);
      setSummary(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-24 skeleton" />)}</div>
      <div className="h-48 skeleton" />
    </div>;
  }

  if (!stats) {
    return <div className="card text-center py-12">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Could not load stats. Check your connection.</p>
    </div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="feature-icon bg-[#DBEAFE] text-[#2563EB] mx-auto mb-2">{icons.zap}</div>
          <div className="text-2xl font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.total_nudges}</div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Nudges (7d)</div>
        </div>
        <div className="card text-center">
          <div className="feature-icon bg-[#F0FDF4] text-[#16A34A] mx-auto mb-2">{icons.clock}</div>
          <div className="text-2xl font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.total_focus_minutes}</div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Focus (min)</div>
        </div>
        <div className="card text-center">
          <div className="feature-icon bg-[#FFF7ED] text-[#EA580C] mx-auto mb-2">{icons.flame}</div>
          <div className="text-2xl font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>{stats.streak_days}</div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Day Streak</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="text-sm font-bold mb-4">Nudges This Week</h2>
        <BarChart data={stats.nudges_by_day} />
      </div>

      {/* Top sites + AI summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-bold mb-3">Top Distracting Sites</h2>
          {stats.top_sites.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No data yet — keep it that way!</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.top_sites.map((s, i) => (
                <li key={s.domain} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#F1F5F9] text-[0.6875rem] font-bold flex items-center justify-center" style={{ color: 'var(--color-text-tertiary)' }}>{i + 1}</span>
                    <span className="font-medium">{s.domain}</span>
                  </span>
                  <span className="badge badge-blue">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            {icons.sparkles} AI Daily Summary
          </h2>
          {summary?.ai_summary ? (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{summary.ai_summary}</p>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Start a focus session or get some nudges to see your daily summary!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
