import React from 'react';

export function StopCard({ name, dates, kicker, photo, status, statusTone = 'accent', count, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 292, flexShrink: 0, background: 'var(--surface)', borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)', padding: '12px 13px', cursor: 'pointer',
      border: '1.5px solid ' + (active ? (statusTone === 'warning' ? 'var(--warning)' : 'var(--accent)') : 'transparent'),
      opacity: active ? 1 : 0.62
    }}>
      <div style={{ display: 'flex', gap: 11 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ font: '700 9.5px/1 var(--font-ui)', letterSpacing: '0.12em', textTransform: 'uppercase', color: active ? 'var(--accent)' : 'var(--ink-3)' }}>{kicker}</span>
          <span style={{ font: '700 16px/1.1 var(--font-ui)', letterSpacing: '-0.35px', color: 'var(--ink)' }}>{name}</span>
          <span style={{ font: '400 11.5px/1 var(--font-ui)', color: 'var(--ink-2)' }}>{dates}</span>
        </div>
        {photo && <div style={{ width: 54, height: 54, borderRadius: 14, overflow: 'hidden', flexShrink: 0 }}>{photo}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--line-soft)' }}>
        <span style={{ font: '600 11px/1 var(--font-ui)', color: statusTone === 'warning' ? 'var(--warning)' : 'var(--accent)' }}>{status}</span>
        <span style={{ marginLeft: 'auto', font: '400 10.5px/1 var(--font-ui)', color: 'var(--ink-3)' }}>{count}</span>
      </div>
    </div>
  );
}
