import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { getBuildLabel } from '@/src/version';

export default function ProfileTab() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.sub}>Settings · Traveler rail · Admin — Plan 6</Text>
      {__DEV__ && <Text style={styles.buildLabel}>{getBuildLabel()}</Text>}
      {__DEV__ && (
        // `replace`, not `push`: leaving this trip should unmount its TripProvider (and
        // the live RTDB listeners it holds) rather than leaving it stacked underneath.
        <TouchableOpacity style={styles.switchButton} onPress={() => router.replace('/(home)' as never)}>
          <Text style={styles.switchButtonText}>Switch trip (dev)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { ...Typography.roles.display, color: Core.text, marginBottom: 8 },
  sub: { ...Typography.roles.meta, color: Core.textMuted, textAlign: 'center' },
  buildLabel: { ...Typography.roles.mono, color: Core.textFaint, textAlign: 'center', marginTop: Spacing.md },

  switchButton: {
    marginTop: Spacing.xxl,
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  switchButtonText: { ...Typography.roles.body, color: Core.text },
});
