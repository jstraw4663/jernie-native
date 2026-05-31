import { useState, useEffect, useCallback } from 'react';
import { database } from '@/src/lib/firebase';

export interface TripConfirmsState {
  confirms: Record<string, boolean>;
  setConfirm: (itemId: string, confirmed: boolean) => void;
}

export function useTripConfirms(tripId: string): TripConfirmsState {
  const [confirms, setConfirms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const confirmsRef = database().ref(`trips/${tripId}/confirms`);
    const listener = (snap: { val: () => Record<string, boolean> | null }) => {
      const val = snap.val();
      if (val === null) return;  // null guard: path doesn't exist yet or device is offline
      setConfirms(val);
    };
    confirmsRef.on('value', listener);
    return () => confirmsRef.off('value', listener);
  }, [tripId]);

  const setConfirm = useCallback((itemId: string, confirmed: boolean) => {
    setConfirms(prev => ({ ...prev, [itemId]: confirmed }));  // optimistic update
    database()
      .ref(`trips/${tripId}/confirms/${itemId}`)
      .set(confirmed)
      .catch(console.error);
  }, [tripId]);

  return { confirms, setConfirm };
}
