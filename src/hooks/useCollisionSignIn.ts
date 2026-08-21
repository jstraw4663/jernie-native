import { useCallback } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useUserTrips } from '@/src/hooks/useUserTrips';
import { confirmCollision } from '@/src/lib/collisionPrompt';
import { adoptAccount, migratableTripIds } from '@/src/lib/tripMigration';

export type CollisionOutcome =
  | { status: 'signed-in'; failed: number }
  | { status: 'cancelled' }
  | { status: 'untrusted' }
  | { status: 'failed' };

/**
 * The whole `auth/credential-already-in-use` branch, in one place.
 *
 * Profile's sign-in button, Profile's share-invite gate, onboarding step 1 and onboarding
 * step 3 all reach this same fork, and all four previously carried their own copy of the
 * trust gate, the prompt and the error handling. They differ only in what they do afterwards.
 */
export function useCollisionSignIn(): (signIn: () => Promise<void>) => Promise<CollisionOutcome> {
  const { user } = useAuth();
  const { trips, status } = useUserTrips();

  return useCallback(async (signIn: () => Promise<void>): Promise<CollisionOutcome> => {
    // useUserTrips() reports 'loading'/'error' with an empty trips array, which would read as
    // "nothing to lose" and abandon silently. Without a uid there is nothing to migrate from.
    if (status !== 'ready' || !user?.uid) return { status: 'untrusted' };

    const tripIds = migratableTripIds(trips);
    const joined = trips.filter(t => t.role !== 'organizer').length;

    const choice = await confirmCollision({ owned: tripIds.length, joined });
    if (choice === 'cancel') return { status: 'cancelled' };

    try {
      // Throws only if the capture or the sign-in itself failed — both leave the user on the
      // anonymous uid with everything intact. A trip that fails to copy afterwards stays
      // staged and is retried, and is reported through `failed` instead.
      const result = await adoptAccount(signIn, {
        fromUid: user.uid,
        tripIds,
        migrate: choice === 'migrate',
      });
      return { status: 'signed-in', failed: result.failed };
    } catch {
      return { status: 'failed' };
    }
  }, [status, trips, user]);
}
