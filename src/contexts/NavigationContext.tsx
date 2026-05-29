import React, { createContext, useContext } from 'react';
import { useRouter } from 'expo-router';
import { setExploreDeepLink, ExploreDeepLink } from '@/src/navigation';

interface NavigationContextValue {
  navigateToExplore: (link: ExploreDeepLink) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  navigateToExplore: () => {},
});

export function NavigationProvider({
  tripId,
  children,
}: {
  tripId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function navigateToExplore(link: ExploreDeepLink) {
    setExploreDeepLink(link);
    router.navigate(`/(trips)/${tripId}/(tabs)/explore`);
  }

  return (
    <NavigationContext.Provider value={{ navigateToExplore }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  return useContext(NavigationContext);
}
