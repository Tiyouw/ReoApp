import React from 'react';

interface ProductivityScoreProps {
  score: number;
  grade: string;
  breakdown: {
    focus: number;
    nudges: number;
    streak: number;
    tasks: number;
  };
}

const GRADE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  S: { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', ring: '#D97706' },
  A: { bg: 'bg-[#D1FAE5]', text: 'text-[#059669]', ring: '#059669' },
  B: { bg: 'bg-[#DBEAFE]', text: 'text-[#2563EB]', ring: '#2563EB' },
  C: { bg: 'bg-[#FFF7ED]', text: 'text-[#EA580C]', ring: '#EA580C' },
  D: { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', ring: '#DC2626' },
};

function getScoreColor(score: number): string {
  if (score >= 80) return '#D97706'; // gold
  if (score >= 60) return '#059669'; // green
  if (score >= 30) return '#EA580C'; // orange
  return '#DC2626'; // red
}

export function ProductivityScore({ score, grade, breakdown }: ProductivityScoreProps) {
  const color = getScoreColor(score);
  const gradeStyle = GRADE_COLORS[grade] || GRADE_COLORS.D;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - score / 100);

  const breakdownItems = [
    { label: 'Focus', value: breakdown.focus, max: 40, icon: '⏱️' },
    { label: 'Low Distractions', value: breakdown.nudges, max: 30, icon: '🛡️' },
    { label: 'Streak', value: breakdown.streak, max: 15, icon: '🔥' },
    { label: 'Tasks', value: breakdown.tasks, max: 15, icon: '✅' },
  ];

  return (
    <div className="card text-center">
      <h2 className="text-sm font-bold uppercase tracking-wider mb-4"
        style={{ color: 'var(--color-text-tertiary)' }}>Today's Score</h2>

      <div className="relative inline-block mb-4">
        {/* Score ring */}
        <svg width="140" height="140" viewBox="0 0 120 120" aria-label={`Score: ${score}`}>
          <circle cx="60" cy="60" r="54" fill="none" stroke="#E2E8F0" strokeWidth="8" />
          <circle cx="60" cy="60" r="54" fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-extrabold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
            {score}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold mt-1 ${gradeStyle.bg} ${gradeStyle.text}`}>
            {grade}
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-2 text-left">
        {breakdownItems.map(item => (
          <div key={item.label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#F8FAFC]">
            <span className="text-sm">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[0.6875rem] font-semibold truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {item.label}
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-1.5 mt-0.5">
                <div className="h-1.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${(item.value / item.max) * 100}%`,
                    backgroundColor: color,
                  }} />
              </div>
            </div>
            <span className="text-[0.625rem] font-bold tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
              {item.value}/{item.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
