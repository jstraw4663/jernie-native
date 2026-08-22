import React from 'react';

export function Chip({ label, icon, selected, variant = 'filter', onClick }) {
  const isDrop = variant === 'dropdown';
  return (
    <span onClick={onClick} style={{
      height: 34, padding: '0 12px', borderRadius: 'var(--radius-full)',
      display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      font: 'var(--text-chip)',
      background: selected ? 'var(--accent)' : (variant === 'solid' ? 'var(--surface-chip)' : 'transparent'),
      color: selected ? '#fff' : 'var(--ink)',
      border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--line)')
    }}>
      {icon}{label}{isDrop && <span style={{ fontSize: 10, color: 'var(--ink-2)' }}>▾</span>}
    </span>
  );
}
