jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: () => undefined, set: () => {}, remove: () => {} }) }));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { AdminUnlockProvider, useAdminUnlock } from '@/src/contexts/AdminUnlockContext';

type Value = ReturnType<typeof useAdminUnlock>;

function Capture({ onCapture }: { onCapture: (v: Value) => void }) {
  onCapture(useAdminUnlock());
  return null;
}

function render(): () => Value {
  let latest!: Value;
  act(() => {
    renderer.create(
      <AdminUnlockProvider>
        <Capture onCapture={v => { latest = v; }} />
      </AdminUnlockProvider>,
    );
  });
  return () => latest;
}

describe('AdminUnlockProvider', () => {
  it('stays locked below five taps', () => {
    const get = render();
    act(() => { for (let i = 0; i < 4; i++) get().registerTabPress(); });
    expect(get().unlocked).toBe(false);
  });

  it('unlocks on the fifth tap', () => {
    const get = render();
    act(() => { for (let i = 0; i < 5; i++) get().registerTabPress(); });
    expect(get().unlocked).toBe(true);
  });

  it('lock() closes the panel AND resets the counter', () => {
    // Without the counter reset the count stays at five, and the very next tab tap re-opens
    // the panel — which reads as the panel refusing to close.
    const get = render();
    act(() => { for (let i = 0; i < 5; i++) get().registerTabPress(); });
    act(() => { get().lock(); });
    expect(get().unlocked).toBe(false);

    act(() => { get().registerTabPress(); });
    expect(get().unlocked).toBe(false);
  });

  it('defaults to locked outside a provider rather than throwing', () => {
    // The tab bar renders this listener before any screen mounts; a throwing default would
    // take down navigation itself.
    let value!: Value;
    act(() => { renderer.create(<Capture onCapture={v => { value = v; }} />); });
    expect(value.unlocked).toBe(false);
    expect(() => value.registerTabPress()).not.toThrow();
  });
});
