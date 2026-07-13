import { useEffect, useState } from 'react';
import { database } from '@/src/lib/firebase';

export interface TripLiveCollectionState<T> {
  items: T[];
  status: 'loading' | 'ready' | 'error';
}

/**
 * Live-listens to `trips/{tripId}/{subpath}` (a keyed-object RTDB collection) and
 * exposes it as an array, injecting the RTDB key into each item via `injectKey`.
 * An empty/missing collection is a normal, common state (e.g. a trip with no
 * travelers or groups yet) — not an error — while listener cancellation is.
 */
export function useTripLiveCollection<T>(
  tripId: string,
  subpath: string,
  injectKey: (raw: unknown, key: string) => T,
): TripLiveCollectionState<T> {
  const [state, setState] = useState<TripLiveCollectionState<T>>({ items: [], status: 'loading' });

  useEffect(() => {
    setState({ items: [], status: 'loading' });
    const ref = database().ref(`trips/${tripId}/${subpath}`);

    const listener = (snap: { val: () => Record<string, unknown> | null }) => {
      const val = snap.val();
      if (val === null) {
        setState({ items: [], status: 'ready' });
        return;
      }
      const items = Object.entries(val).map(([key, raw]) => injectKey(raw, key));
      setState({ items, status: 'ready' });
    };

    const onCancel = () => setState(prev => ({ ...prev, status: 'error' }));

    ref.on('value', listener, onCancel);
    return () => ref.off('value', listener);
  }, [tripId, subpath]);

  return state;
}
