import React from 'react';

const SIZES = { lg: { h: 52, font: 'var(--text-button)', r: 'var(--radius-row)' },
                md: { h: 44, font: 'var(--text-button)', r: 'var(--radius-tile)' },
                sm: { h: 30, font: '700 11.5px/1 var(--font-ui)', r: 'var(--radius-full)' } };

export function Button({ label, variant = 'primary', size = 'lg', icon, iconRight, disabled, full = true, onClick }) {
  const s = SIZES[size] || SIZES.lg;
  const base = {
    height: s.h, borderRadius: s.r, font: s.font, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: size === 'sm' ? '0 13px' : '0 18px', cursor: disabled ? 'default' : 'pointer',
    width: full && size !== 'sm' ? '100%' : undefined, border: '1.5px solid transparent',
    opacity: disabled ? 0.5 : 1, transition: 'opacity var(--dur-fast) var(--ease-standard)'
  };
  const skin = {
    primary: { background: 'var(--ink)', color: 'var(--surface)' },
    secondary: { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' },
    ghost: { background: 'transparent', color: 'var(--ink-2)' },
    accent: { background: 'var(--accent)', color: '#fff' },
    dark: { background: '#000', color: '#fff' }
  }[variant];

  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ ...base, ...skin }}>
      {icon}{label}{iconRight}
    </button>
  );
}
