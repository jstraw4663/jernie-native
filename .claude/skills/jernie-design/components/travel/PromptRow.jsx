import React from 'react';

export function PromptRow({ title, sub, action, icon, urgent, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', cursor: 'pointer',
      border: '1.5px dashed ' + (urgent ? 'var(--warning-line)' : 'var(--line)'),
      borderRadius: 'var(--radius-row)', background: urgent ? 'var(--warning-soft)' : 'transparent'
    }}>
      <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-tile)', display: 'grid', placeItems: 'center', flexShrink: 0,
        background: urgent ? 'var(--warning-soft)' : 'var(--surface-chip)', color: urgent ? 'var(--warning)' : 'var(--ink-2)' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: 'var(--text-row)', color: 'var(--ink)' }}>{title}</span>
        <span style={{ display: 'block', font: 'var(--text-sub)', color: urgent ? 'var(--warning)' : 'var(--ink-2)', marginTop: 3 }}>{sub}</span>
      </span>
      {action && <span style={{ height: 28, padding: '0 11px', borderRadius: 14, background: 'var(--ink)', color: 'var(--surface)', display: 'flex', alignItems: 'center', font: '700 11px/1 var(--font-ui)', flexShrink: 0 }}>{action}</span>}
    </div>
  );
}
