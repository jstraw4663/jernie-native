import { updateTrip, archiveTrip, restoreTrip } from '@/src/lib/tripWrites';
import type { TripPatch } from '@/src/lib/tripWrites';

export interface TripAdminState {
  updateTrip: (tripId: string, patch: TripPatch) => Promise<void>;
  archiveTrip: (tripId: string) => Promise<void>;
  restoreTrip: (tripId: string) => Promise<void>;
}

// Thin pass-through, matching useBooking/useEditStop. The lib functions are stable
// module-level references, so useCallback would add nothing.
export function useTripAdmin(): TripAdminState {
  return { updateTrip, archiveTrip, restoreTrip };
}
