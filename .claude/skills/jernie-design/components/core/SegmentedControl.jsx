import React from 'react';

export function SegmentedControl({ options, value, onChange, size = 'md' }) {
  const h = size === 'sm' ? 28 : 38;
  return (
    <div style={{ height: h, borderRadius: 'var(--radius-tile)', background: 'var(--surface-chip)', display: 'flex', alignItems: 'center', padding: 3, gap: 1 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <span key={o.value} onClick={() => onChange && onChange(o.value)} style={{
            flex: 1, height: h - 6, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            font: 'var(--text-chip)', cursor: 'pointer',
            background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-2)',
            boxShadow: on ? 'var(--shadow-row)' : 'none'
          }}>{o.icon}{o.label}</span>
        );
      })}
    </div>
  );
}
