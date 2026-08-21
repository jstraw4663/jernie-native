import { Alert } from 'react-native';

/**
 * Asked when an Apple ID already belongs to another Jernie account. Signing into it
 * abandons the current anonymous uid — which only matters if that uid owns trips, so a
 * user with nothing to lose is never warned.
 */
export function confirmAdoptExistingAccount(ownedTripCount: number): Promise<boolean> {
  if (ownedTripCount === 0) return Promise.resolve(true);
  const noun = ownedTripCount === 1 ? 'trip' : 'trips';
  return new Promise(resolve => {
    Alert.alert(
      'That Apple ID already has an account',
      `Signing into it leaves ${ownedTripCount} ${noun} behind on this phone. They can't be moved, and you won't be able to reach them again.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign in anyway', style: 'destructive', onPress: () => resolve(true) },
      ],
    );
  });
}
