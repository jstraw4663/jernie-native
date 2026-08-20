import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { ConnectivityProvider } from '@/src/contexts/ConnectivityContext';
import { SheetProvider } from '@/src/contexts/SheetContext';
import { maybeSeedDevData } from '@/src/lib/devSeed';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: require('../assets/fonts/Fraunces.ttf'),
    'Fraunces-Italic': require('../assets/fonts/Fraunces-Italic.ttf'),
    DMSans: require('../assets/fonts/DMSans.ttf'),
    'DMSans-Italic': require('../assets/fonts/DMSans-Italic.ttf'),
    DMMono: require('../assets/fonts/DMMono-Regular.ttf'),
    'DMMono-Medium': require('../assets/fonts/DMMono-Medium.ttf'),
    'DMMono-Italic': require('../assets/fonts/DMMono-Italic.ttf'),
  });

  useEffect(() => {
    // AuthProvider (mounted below) now owns initAuth(); maybeSeedDevData() waits for the
    // resulting user itself via getAuthedUser(), so it no longer needs to be chained here.
    maybeSeedDevData().catch(console.error);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <ConnectivityProvider>
            <SheetProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </SheetProvider>
          </ConnectivityProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
