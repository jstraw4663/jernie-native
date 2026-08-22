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
  // Six static faces — every weight the design specifies, and nothing else. Static, not
  // variable: React Native cannot drive a variable font's `wght` axis, so each weight needs
  // its own file and its own family name. `fontWeight` in tokens.ts is advisory; the family
  // name is what selects the weight. The design uses no italic and no bold serif, so no
  // italic or Fraunces-Bold face is bundled.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: require('../assets/fonts/Fraunces-Regular.ttf'),
    DMSans: require('../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-SemiBold': require('../assets/fonts/DMSans-SemiBold.ttf'),
    'DMSans-Bold': require('../assets/fonts/DMSans-Bold.ttf'),
    DMMono: require('../assets/fonts/DMMono-Regular.ttf'),
    'DMMono-Medium': require('../assets/fonts/DMMono-Medium.ttf'),
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
