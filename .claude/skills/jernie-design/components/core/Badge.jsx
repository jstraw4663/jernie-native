import React from 'react';

const TONES = {
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  neutral: { bg: 'var(--surface-chip)', fg: 'var(--ink-2)' },
  solid: { bg: 'var(--accent)', fg: '#fff' }
};

export function Badge({ label, tone = 'neutral' }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{
      height: 20, padding: '0 8px', borderRadius: 10, display: 'inline-flex', alignItems: 'center',
      background: t.bg, color: t.fg, font: '700 9.5px/1 var(--font-ui)',
      letterSpacing: '0.05em', textTransform: 'uppercase'
    }}>{label}</span>
  );
}
