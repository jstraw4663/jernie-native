import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { getBuildLabel } from '@/src/version';
import { useTripContext } from '@/src/contexts/TripContext';

export default function ProfileTab() {
  const router = useRouter();
  const { trip } = useTripContext();
  const inviteLink = `jernie://join/${trip.inviteToken}`;

  const handleShareInvite = () => {
    Share.share({
      message: `Join "${trip.name}" on Jernie: ${inviteLink}`,
      url: inviteLink,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.sub}>Settings · Traveler rail · Admin — Plan 6</Text>
      {__DEV__ && <Text style={styles.buildLabel}>{getBuildLabel()}</Text>}

      <View style={styles.inviteBlock}>
        <Text style={styles.inviteLabel}>Invite travelers</Text>
        <Text style={styles.inviteLink} selectable>{inviteLink}</Text>
        <TouchableOpacity testID="share-invite-button" style={styles.inviteButton} onPress={handleShareInvite}>
          <Text style={styles.inviteButtonText}>Share invite link</Text>
        </TouchableOpacity>
      </View>

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

  inviteBlock: {
    marginTop: Spacing.xxl,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inviteLabel: { ...Typography.roles.label, color: Core.textMuted },
  inviteLink: { ...Typography.roles.mono, color: Core.text, textAlign: 'center' },
  inviteButton: {
    marginTop: Spacing.xs,
    backgroundColor: Core.action,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  inviteButtonText: { ...Typography.roles.button, color: Core.textInverse },

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
