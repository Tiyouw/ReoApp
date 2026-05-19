import React from 'react';

export type MascotMood = 'happy' | 'idle' | 'disappointed' | 'angry';

interface MascotMoodProps {
  mood: MascotMood;
  size?: number;
}

const MOOD_CONFIG: Record<MascotMood, {
  filter: string;
  animation: string;
  emoji: string;
  tooltip: string;
  overlayColor: string;
}> = {
  happy: {
    filter: 'none',
    animation: 'mascot-happy',
    emoji: '🎉',
    tooltip: "I'm proud of you! Keep going!",
    overlayColor: 'transparent',
  },
  idle: {
    filter: 'saturate(0.4) brightness(0.9)',
    animation: 'mascot-idle-pulse',
    emoji: '😴',
    tooltip: 'Hello? Anyone there?',
    overlayColor: 'rgba(148, 163, 184, 0.2)',
  },
  disappointed: {
    filter: 'hue-rotate(20deg) saturate(1.3)',
    animation: 'mascot-disappointed',
    emoji: '😤',
    tooltip: 'You can do better than this...',
    overlayColor: 'rgba(234, 88, 12, 0.15)',
  },
  angry: {
    filter: 'hue-rotate(-10deg) saturate(1.5) contrast(1.1)',
    animation: 'mascot-angry',
    emoji: '🔥',
    tooltip: 'SERIOUSLY?! Get back to work!',
    overlayColor: 'rgba(220, 38, 38, 0.15)',
  },
};

export function getMood(stats: {
  streak: number;
  nudgesToday: number;
  focusToday: number;
}): MascotMood {
  if (stats.streak >= 3 || stats.focusToday >= 60) return 'happy';
  if (stats.nudgesToday > 10 && stats.focusToday < 15) return 'angry';
  if (stats.nudgesToday > 5) return 'disappointed';
  if (stats.focusToday === 0 && stats.nudgesToday === 0) return 'idle';
  return 'happy';
}

export function MascotMood({ mood, size = 144 }: MascotMoodProps) {
  const config = MOOD_CONFIG[mood];

  return (
    <div
      className={`relative inline-block ${config.animation}`}
      title={`${config.emoji} ${config.tooltip}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/mascot.png"
        alt={`Reo mascot — ${mood}`}
        width={size}
        height={size}
        className="object-contain transition-all duration-500"
        style={{ filter: config.filter }}
        fetchPriority="high"
      />
      {/* Mood overlay */}
      <div
        className="absolute inset-0 rounded-full transition-colors duration-500"
        style={{ backgroundColor: config.overlayColor }}
      />
      {/* Emoji badge */}
      <span
        className="absolute -top-1 -right-1 text-lg select-none transition-transform duration-300"
        style={{ fontSize: size > 100 ? '1.5rem' : '1rem' }}
      >
        {config.emoji}
      </span>
    </div>
  );
}
