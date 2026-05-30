import { View, Text, StyleSheet } from 'react-native';
import { Core, Brand, Typography } from '@/src/design/tokens';

export default function OnboardingStep1() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step 1</Text>
      <Text style={styles.sub}>Trip name + vibe chips — Plan 2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.navy, justifyContent: 'center', alignItems: 'center' },
  title: { ...Typography.roles.h1, color: Core.white, marginBottom: 8 },
  sub: { ...Typography.roles.meta, color: 'rgba(255,255,255,0.5)' },
});
