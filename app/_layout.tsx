import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConnectivityProvider } from '@/src/contexts/ConnectivityContext';
import { SheetProvider } from '@/src/contexts/SheetContext';
import { initAuth } from '@/src/lib/firebase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: require('../assets/fonts/Fraunces[SOFT,WONK,opsz,wght].ttf'),
    'Fraunces-Italic': require('../assets/fonts/Fraunces-Italic[SOFT,WONK,opsz,wght].ttf'),
    DMSans: require('../assets/fonts/DMSans[opsz,wght].ttf'),
    'DMSans-Italic': require('../assets/fonts/DMSans-Italic[opsz,wght].ttf'),
    DMMono: require('../assets/fonts/DMMono-Regular.ttf'),
    'DMMono-Medium': require('../assets/fonts/DMMono-Medium.ttf'),
    'DMMono-Italic': require('../assets/fonts/DMMono-Italic.ttf'),
  });

  useEffect(() => {
    initAuth().catch(console.error);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConnectivityProvider>
        <SheetProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SheetProvider>
      </ConnectivityProvider>
    </GestureHandlerRootView>
  );
}
