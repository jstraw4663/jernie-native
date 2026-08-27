import React from 'react';

export function Toggle({ on, onChange }) {
  return (
    <span onClick={() => onChange && onChange(!on)} style={{
      width: 44, height: 26, borderRadius: 13, padding: 2, display: 'inline-flex', alignItems: 'center',
      justifyContent: on ? 'flex-end' : 'flex-start', cursor: 'pointer',
      background: on ? 'var(--accent)' : 'var(--line)',
      transition: 'background var(--dur-fast) var(--ease-standard)'
    }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: 'var(--shadow-row)' }} />
    </span>
  );
}
