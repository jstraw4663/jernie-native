import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Typography } from '@/src/design/tokens';

export default function MyTripsScreen() {
  const router = useRouter();

  useEffect(() => {
    if (__DEV__) {
      router.replace('/(trips)/dev-trip-001/(tabs)/jernie' as never);
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Trips</Text>
      <Text style={styles.sub}>Coming in Plan 2 — Auth + Onboarding</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg, justifyContent: 'center', alignItems: 'center' },
  title: { ...Typography.roles.h1, color: Core.text, marginBottom: 8 },
  sub: { ...Typography.roles.meta, color: Core.textMuted },
});
