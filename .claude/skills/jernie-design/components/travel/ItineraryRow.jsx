import React from 'react';

export function ItineraryRow({ time, duration, title, sub, icon, photo, badge, now, warn, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', gap: 11, padding: '10px 0', borderTop: '1px solid var(--line-soft)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ width: 44, flexShrink: 0, paddingTop: 3 }}>
        <span style={{ display: 'block', font: 'var(--text-data)', color: now ? 'var(--accent)' : 'var(--ink-2)' }}>{time}</span>
        {duration && <span style={{ display: 'block', font: 'var(--text-data-sm)', color: 'var(--ink-3)', marginTop: 4 }}>{duration}</span>}
      </span>
      <span style={{ width: 44, height: 44, borderRadius: 'var(--radius-tile)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-chip)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
        {photo || icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <span style={{ display: 'block', font: 'var(--text-row)', color: 'var(--ink)' }}>{title}</span>
        <span style={{ display: 'block', font: 'var(--text-sub)', color: warn ? 'var(--warning)' : 'var(--ink-2)', marginTop: 2 }}>{sub}</span>
      </span>
      {badge}
    </div>
  );
}
