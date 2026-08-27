import React from 'react';

export function StatStrip({ stats, onPhoto }) {
  return (
    <div style={{ display: 'flex', gap: 22 }}>
      {stats.map((s) => (
        <span key={s.label}>
          <span style={{ display: 'block', font: '700 21px/1 var(--font-ui)', letterSpacing: '-0.5px', color: onPhoto ? 'var(--on-photo)' : 'var(--ink)' }}>{s.value}</span>
          <span style={{ display: 'block', font: '600 9.5px/1 var(--font-ui)', letterSpacing: '0.11em', textTransform: 'uppercase', marginTop: 5, color: onPhoto ? 'var(--on-photo-2)' : 'var(--ink-3)' }}>{s.label}</span>
        </span>
      ))}
    </div>
  );
}
