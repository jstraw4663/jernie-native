import { useCallback, useState } from 'react';
import { auth, getAuthedUser, database } from '@/src/lib/firebase';
import type { TripMemberRole } from '@/src/types';

export type JoinTripStatus = 'idle' | 'joining' | 'success' | 'error';

export interface JoinTripState {
  joinTrip: (token: string, handle?: string) => Promise<{ tripId: string }>;
  status: JoinTripStatus;
  error: Error | null;
}

// Joining a trip is a strictly sequential two-step write, never a single bundled update().
// RTDB security rules cannot cross-reference a sibling path written in the *same*
// multi-location update() call — they observe that sibling's pre-update state, not its
// post-update state (proven empirically against the emulator during Task 1's schema/rules
// design; see database.rules.json's joinProofs/members rules and Task 1's report). So:
//   step 1 — a standalone .set() on joinProofs/{uid}, awaited to completion
//   step 2 — only after step 1 resolves, a separate .update() bundling members/{uid} +
//            the user's trips index entry
// If step 1 succeeds but step 2 fails (e.g. wrong token), step 1's write is safely retriable —
// calling joinTrip again just re-attempts both steps.
export function useJoinTrip(): JoinTripState {
  const [status, setStatus] = useState<JoinTripStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const joinTrip = useCallback(async (token: string, handle?: string): Promise<{ tripId: string }> => {
    setStatus('joining');
    setError(null);
    try {
      await getAuthedUser();
      const uid = auth().currentUser?.uid;
      if (!uid) throw new Error('not authenticated');

      const tokenSnap = await database().ref(`inviteTokens/${token}`).once('value');
      const tripId = tokenSnap.val() as string | null;
      if (!tripId) throw new Error('invite token not found');

      // Step 1 — standalone, awaited to completion before step 2 is even attempted.
      await database().ref(`trips/${tripId}/joinProofs/${uid}`).set(token);

      // Step 2 — only after step 1 has committed. Exactly two paths, bundled together.
      const joinedAt = Date.now();
      const role: TripMemberRole = 'traveler';
      const resolvedHandle = handle?.trim() || auth().currentUser?.displayName || 'Traveler';
      await database().ref().update({
        [`trips/${tripId}/members/${uid}`]: { uid, handle: resolvedHandle, role, joinedAt },
        [`users/${uid}/trips/${tripId}`]: { role, joinedAt },
      });

      setStatus('success');
      return { tripId };
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      setStatus('error');
      setError(normalized);
      throw normalized;
    }
  }, []);

  return { joinTrip, status, error };
}
