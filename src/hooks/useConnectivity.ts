import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export interface ConnectivityState {
  isOnline: boolean;
  wasOffline: boolean;
}

export function useConnectivity(): ConnectivityState {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Fetch initial state
    NetInfo.fetch().then((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline((prev) => {
        if (!prev && online) setWasOffline(true);  // was offline, now reconnected
        return online;
      });
    });

    return unsubscribe;
  }, []);

  return { isOnline, wasOffline };
}
