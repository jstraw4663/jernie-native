import { Alert } from 'react-native';

export type CollisionChoice = 'migrate' | 'abandon' | 'cancel';

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Asked when an Apple ID already belongs to another Jernie account.
 *
 * Signing in abandons the current anonymous uid, and that uid becomes unreachable the moment
 * it happens. Trips it OWNS can be carried across as copies (see tripMigration.ts); trips it
 * merely joined belong to someone else and cannot be, so they are called out separately
 * rather than folded into a single count that implies they could be saved.
 *
 * With nothing at stake at all, there is nothing to ask.
 */
export function confirmCollision(counts: { owned: number; joined: number }): Promise<CollisionChoice> {
  if (counts.owned === 0 && counts.joined === 0) return Promise.resolve('migrate');

  const strandedNote = counts.joined > 0
    ? ` ${counts.joined} ${plural(counts.joined, 'trip', 'trips')} you joined from an invite link ` +
      `${plural(counts.joined, 'stays', 'stay')} behind either way — ${plural(counts.joined, 'it belongs', 'they belong')} to whoever created ${plural(counts.joined, 'it', 'them')}.`
    : '';

  // Nothing this uid owns, so there is no third option to offer — only whether to go ahead.
  if (counts.owned === 0) {
    return new Promise(resolve => {
      Alert.alert(
        'That Apple ID already has an account',
        `Signing into it leaves ${counts.joined} ${plural(counts.joined, 'trip', 'trips')} behind on this phone.` +
          `${strandedNote} You won't be able to reach ${plural(counts.joined, 'it', 'them')} again.`,
        [
          { text: 'Sign in anyway', style: 'destructive', onPress: () => resolve('abandon') },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        ],
      );
    });
  }

  const it = plural(counts.owned, 'it', 'them');
  const subject = counts.owned === 1
    ? 'The trip you made on this phone'
    : `The ${counts.owned} trips you made on this phone`;

  return new Promise(resolve => {
    Alert.alert(
      `Bring your ${plural(counts.owned, 'trip', 'trips')} with you?`,
      `That Apple ID already has an account. ${subject} can come with you, or stay behind — ` +
        `abandoning can't be undone.${strandedNote}`,
      [
        { text: `Bring ${it} with me`, onPress: () => resolve('migrate') },
        { text: `Abandon ${plural(counts.owned, 'trip', 'trips')}`, style: 'destructive', onPress: () => resolve('abandon') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
      ],
    );
  });
}
