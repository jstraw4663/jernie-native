import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useConnectivity, ConnectivityState } from '@/src/hooks/useConnectivity';
import { getQueue, flush as flushQueue, subscribe as subscribeQueue } from '@/src/lib/writeQueue';
import { database } from '@/src/lib/firebase';

interface ConnectivityContextValue extends ConnectivityState {
  pendingWriteCount: number;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  isOnline: true,
  wasOffline: false,
  pendingWriteCount: 0,
});

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, wasOffline } = useConnectivity();
  const [pendingWriteCount, setPendingWriteCount] = useState(getQueue().length);
  const prevOnline = useRef(isOnline);

  // Flush write queue on reconnect
  useEffect(() => {
    if (isOnline && !prevOnline.current) {
      const entries = getQueue();
      entries.forEach((entry) => {
        database().ref(entry.path).set(entry.value).catch(() => {
          // Failed writes stay in queue for next flush attempt
        });
      });
      flushQueue();
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  // Keep pending count in sync via writeQueue subscriber
  useEffect(() => {
    const unsubscribe = subscribeQueue((count) => {
      setPendingWriteCount(count);
    });
    return unsubscribe;
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline, wasOffline, pendingWriteCount }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivityState(): ConnectivityContextValue {
  return useContext(ConnectivityContext);
}
