jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act } from '@testing-library/react-native';
import { useTripLiveCollection } from '@/src/hooks/useTripLiveCollection';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockOn, mockOff, mockRef } = jest.requireMock('@react-native-firebase/database');

let capturedOnCallback: ((snap: { val: () => unknown }) => void) | null = null;
let capturedCancelCallback: ((err: Error) => void) | null = null;
beforeEach(() => {
  jest.clearAllMocks();
  capturedOnCallback = null;
  capturedCancelCallback = null;
  (mockOn as jest.Mock).mockImplementation(
    (_event: string, cb: (snap: { val: () => unknown }) => void, cancelCb?: (err: Error) => void) => {
      capturedOnCallback = cb;
      capturedCancelCallback = cancelCb ?? null;
      return cb;
    },
  );
});

interface Widget { id: string; label: string }

describe('useTripLiveCollection', () => {
  test('opens a listener at trips/{tripId}/{subpath}', () => {
    renderHook(() => useTripLiveCollection<Widget>('trip-1', 'widgets', (raw, key) => ({ ...(raw as object), id: key } as Widget)));
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/widgets');
  });

  test('starts loading, then maps a keyed object into an array via injectKey', () => {
    const { result } = renderHook(() =>
      useTripLiveCollection<Widget>('trip-1', 'widgets', (raw, key) => ({ ...(raw as object), id: key } as Widget)),
    );
    expect(result.current.status).toBe('loading');

    act(() => {
      capturedOnCallback?.({ val: () => ({ 'widget-a': { label: 'A' }, 'widget-b': { label: 'B' } }) });
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.find(w => w.label === 'A')?.id).toBe('widget-a');
  });

  test('a null snapshot is a ready empty array, not an error', () => {
    const { result } = renderHook(() =>
      useTripLiveCollection<Widget>('trip-1', 'widgets', (raw, key) => ({ ...(raw as object), id: key } as Widget)),
    );
    act(() => { capturedOnCallback?.({ val: () => null }); });
    expect(result.current.status).toBe('ready');
    expect(result.current.items).toEqual([]);
  });

  test('cancel callback surfaces status: error', () => {
    const { result } = renderHook(() =>
      useTripLiveCollection<Widget>('trip-1', 'widgets', (raw, key) => ({ ...(raw as object), id: key } as Widget)),
    );
    act(() => { capturedCancelCallback?.(new Error('permission denied')); });
    expect(result.current.status).toBe('error');
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() =>
      useTripLiveCollection<Widget>('trip-1', 'widgets', (raw, key) => ({ ...(raw as object), id: key } as Widget)),
    );
    unmount();
    expect(mockOff).toHaveBeenCalled();
  });
});
