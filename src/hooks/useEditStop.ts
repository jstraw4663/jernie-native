import { updateStop, removeStop } from '@/src/lib/stopWrites';
import type { StopPatch } from '@/src/lib/stopWrites';

export interface EditStopState {
  updateStop: (tripId: string, stopId: string, patch: StopPatch) => Promise<void>;
  removeStop: (tripId: string, stopId: string) => Promise<void>;
}

export function useEditStop(): EditStopState {
  return { updateStop, removeStop };
}
