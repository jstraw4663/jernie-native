import React from 'react';

export function GapRow({ title, sub, action = 'Add', onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px',
      border: '1.5px dashed var(--warning-line)', borderRadius: 'var(--radius-row)', background: 'var(--warning-soft)'
    }}>
      <span style={{ width: 28, height: 28, borderRadius: 'var(--radius-icon)', background: 'var(--warning-soft)', color: 'var(--warning)', display: 'grid', placeItems: 'center', flexShrink: 0, font: '700 13px/1 var(--font-ui)' }}>!</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '700 12.5px/16px var(--font-ui)', color: 'var(--warning-ink)' }}>{title}</span>
        <span style={{ display: 'block', font: 'var(--text-data-sm)', color: 'var(--warning)', marginTop: 2 }}>{sub}</span>
      </span>
      <span onClick={onAction} style={{ height: 26, padding: '0 10px', borderRadius: 13, background: 'var(--ink)', color: 'var(--surface)', display: 'flex', alignItems: 'center', font: '700 11px/1 var(--font-ui)', cursor: 'pointer', flexShrink: 0 }}>{action}</span>
    </div>
  );
}
