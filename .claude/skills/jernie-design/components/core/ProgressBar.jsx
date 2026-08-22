import React from 'react';

export function ProgressBar({ value = 0, segments, height = 5 }) {
  if (segments) {
    return (
      <div style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: segments.total }).map((_, i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < segments.done ? 'var(--accent)' : 'var(--line)' }} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ height, borderRadius: height / 2, background: 'var(--surface-chip)', overflow: 'hidden' }}>
      <span style={{ display: 'block', width: Math.max(0, Math.min(100, value)) + '%', height: '100%', background: 'var(--accent)', transition: 'width var(--dur-normal) var(--ease-standard)' }} />
    </div>
  );
}
