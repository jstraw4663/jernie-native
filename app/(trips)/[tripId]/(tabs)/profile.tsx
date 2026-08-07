import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Semantic, Typography, Radius, Spacing } from '@/src/design/tokens';
import { getBuildLabel } from '@/src/version';
import { useTripContext } from '@/src/contexts/TripContext';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';
import { confirmDelete } from '@/src/utils/confirmDelete';
import { auth } from '@/src/lib/firebase';

export default function ProfileTab() {
  const router = useRouter();
  const { trip, refetch } = useTripContext();
  const { updateTrip, archiveTrip } = useTripAdmin();
  const [name, setName] = useState(trip.name);
  const [error, setError] = useState<string | null>(null);
  const inviteLink = `jernie://join/${trip.inviteToken}`;

  const isOwner = trip.ownerUid === auth().currentUser?.uid;
  const saveDisabled = name.trim().length === 0 || name === trip.name;

  const handleShareInvite = () => {
    Share.share({
      message: `Join "${trip.name}" on Jernie: ${inviteLink}`,
      url: inviteLink,
    });
  };

  const handleSave = async () => {
    if (saveDisabled) return;
    try {
      await updateTrip(trip.id, { name });
      setError(null);
      refetch();
    } catch {
      setError("Couldn't save the trip name. Try again.");
    }
  };

  const handleDelete = () => {
    confirmDelete({
      title: 'Delete trip?',
      message: `"${trip.name}" moves to Recently Deleted. You can restore it from My Trips.`,
      confirmLabel: 'Delete trip',
      onConfirm: () => {
        archiveTrip(trip.id)
          .then(() => router.replace('/(home)' as never))
          .catch(() => setError("Couldn't delete this trip. Try again."));
      },
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

      {isOwner && (
        <View style={styles.settingsBlock}>
          <Text style={styles.settingsLabel}>Trip name</Text>
          <TextInput
            testID="trip-name-input"
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity
            testID="save-trip-button"
            disabled={saveDisabled}
            style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity testID="delete-trip-button" style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete trip</Text>
          </TouchableOpacity>
        </View>
      )}

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

  settingsBlock: {
    marginTop: Spacing.xxl,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingsLabel: { ...Typography.roles.label, color: Core.textMuted },
  nameInput: {
    ...Typography.roles.body,
    color: Core.text,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    width: '100%',
    textAlign: 'center',
  },
  saveButton: {
    marginTop: Spacing.xs,
    backgroundColor: Core.action,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: { ...Typography.roles.button, color: Core.textInverse },
  errorText: { ...Typography.roles.meta, color: Semantic.error, textAlign: 'center' },

  deleteButton: {
    marginTop: Spacing.md,
    backgroundColor: Semantic.errorTint,
    borderWidth: 1,
    borderColor: Semantic.error,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  deleteButtonText: { ...Typography.roles.button, color: Semantic.error },

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
