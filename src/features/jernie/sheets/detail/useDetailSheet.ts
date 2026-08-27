// One place that knows how to open the detail sheet, because three screens do it.
//
// Home, Agenda and Explore all present the same sheet over the same trip, and before this
// each one assembled its own payload — the stop lookup, the enrichment map, the colour that
// no longer exists. The hook takes the trip context once and leaves each screen with the
// only part that is actually its own: what the footer action does.
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef } from 'react';
import { useTripContext } from '@/src/contexts/TripContext';
import type { Booking, Place } from '@/src/types';
import type { DetailSheetRef } from './DetailSheet';
import type { DetailPayload } from './types';

/** What differs per call site. Everything else the hook already has. */
export type OpenOptions = Pick<DetailPayload, 'isAdded' | 'onAdd' | 'onEdit'>;

export function useDetailSheet() {
  const sheet = useRef<DetailSheetRef>(null);
  const { trip, stops, places, enrichment } = useTripContext();
  const router = useRouter();

  const viewItinerary = useCallback(() => {
    sheet.current?.dismiss();
    // `navigate`, not `push` — Agenda is a sibling tab, not a screen to stack on top.
    router.navigate(`/(trips)/${trip.id}/(tabs)/agenda` as never);
  }, [router, trip.id]);

  const shared = useMemo(() => ({ places, enrichment, onViewItinerary: viewItinerary }),
    [places, enrichment, viewItinerary]);

  const openPlace = useCallback((place: Place, opts?: OpenOptions) => {
    sheet.current?.present({
      subject: { kind: 'place', place },
      stop: stops.find(st => st.id === place.stopId),
      ...shared,
      ...opts,
    });
  }, [stops, shared]);

  const openBooking = useCallback((booking: Booking, opts?: OpenOptions) => {
    const onEdit = opts?.onEdit;
    sheet.current?.present({
      subject: { kind: 'booking', booking },
      stop: stops.find(st => st.id === booking.stopId),
      ...shared,
      ...opts,
      // Keep one modal transition in flight. The form replaces the detail sheet rather
      // than stacking over it and leaving SheetContext two levels deep.
      onEdit: onEdit ? () => {
        sheet.current?.dismiss();
        onEdit();
      } : undefined,
    });
  }, [stops, shared]);

  const dismiss = useCallback(() => { sheet.current?.dismiss(); }, []);

  return useMemo(() => ({ sheet, openPlace, openBooking, dismiss }),
    [openPlace, openBooking, dismiss]);
}
