import React from 'react';

export function ListRow({ title, sub, media, lead, trailing, bordered = true, tone = 'default', subTone, onClick }) {
  const toneStyles = {
    default: { border: '1px solid var(--line)', background: 'transparent' },
    accent: { border: '1.5px solid var(--accent-line)', background: 'var(--accent-soft)' },
    plain: { border: 'none', borderTop: '1px solid var(--line-soft)', background: 'transparent', borderRadius: 0 }
  }[tone];

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: tone === 'plain' ? '10px 0' : '10px 12px',
      borderRadius: tone === 'plain' ? 0 : 'var(--radius-row)',
      cursor: onClick ? 'pointer' : 'default',
      ...(bordered ? toneStyles : { background: 'transparent' })
    }}>
      {lead}
      {media}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: 'var(--text-row)', letterSpacing: 'var(--tracking-row)', color: 'var(--ink)' }}>{title}</span>
        {sub && <span style={{ display: 'block', font: 'var(--text-sub)', color: subTone === 'accent' ? 'var(--accent)' : subTone === 'warning' ? 'var(--warning)' : 'var(--ink-2)', marginTop: 2 }}>{sub}</span>}
      </span>
      {trailing}
    </div>
  );
}
