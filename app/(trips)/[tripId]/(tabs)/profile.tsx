import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Semantic, Typography, Radius, Spacing } from '@/src/design/tokens';
import { getBuildLabel } from '@/src/version';
import { useTripContext } from '@/src/contexts/TripContext';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';
import { confirmDelete } from '@/src/utils/confirmDelete';
import { useAuth } from '@/src/contexts/AuthContext';
import { useCollisionSignIn } from '@/src/hooks/useCollisionSignIn';

export default function ProfileTab() {
  const router = useRouter();
  const { trip, refetch } = useTripContext();
  const { updateTrip, archiveTrip } = useTripAdmin();
  const [name, setName] = useState(trip.name);
  // Two independent error slots. A single shared one rendered in both the Account block and
  // the owner-only trip-settings block, so one failed sign-in printed the same message twice
  // on screen — under Account and again under Save.
  const [accountError, setAccountError] = useState<string | null>(null);
  const [tripError, setTripError] = useState<string | null>(null);
  const inviteLink = `jernie://join/${trip.inviteToken}`;

  const saveDisabled = name.trim().length === 0 || name === trip.name;

  const { status, user, signInWithApple, signOut, deleteAccount } = useAuth();
  const adoptOnCollision = useCollisionSignIn();

  // `user` from useAuth(), not auth().currentUser read directly — the latter is
  // non-reactive (no re-render on change) and reads stale/false during the brief window a
  // delete or sign-out is in flight and the uid has already moved on underneath it.
  const isOwner = trip.ownerUid === user?.uid;

  // Same four-branch handling as handleShareInvite below: a bare `void signInWithApple()`
  // discarded collision, error and cancellation alike, so an anonymous user tapping this
  // button could never see why nothing happened.
  const handleSignIn = async () => {
    const outcome = await signInWithApple();
    if (outcome.ok) return;
    if (outcome.reason === 'credential-already-in-use') {
      const result = await adoptOnCollision(outcome.signIn);
      if (result.status === 'untrusted') {
        setAccountError("Can't verify your trips yet — try again in a moment.");
      } else if (result.status === 'failed') {
        setAccountError("Couldn't sign in. Try again.");
      } else if (result.status === 'signed-in' && result.failed > 0) {
        setAccountError('Signed in. Your trip is still copying across — it will appear shortly.');
      }
      return;
    }
    if (outcome.reason === 'cancelled') return;
    setAccountError(outcome.message);
  };

  const handleShareInvite = async () => {
    // An unlinked organizer who loses their device orphans the trip for every traveller
    // in it, not just themselves. That is what this gate protects.
    if (status !== 'authenticated') {
      const outcome = await signInWithApple();
      if (!outcome.ok) {
        if (outcome.reason === 'credential-already-in-use') {
          const result = await adoptOnCollision(outcome.signIn);
          if (result.status === 'untrusted') {
            setAccountError("Can't verify your trips yet — try again in a moment.");
          } else if (result.status === 'failed') {
            setAccountError("Couldn't sign in. Try again.");
          }
          // Signing into another account abandons the uid that owns *this* trip. Even when
          // the trip is copied across, the copy has a different id and a different invite
          // token, so this screen's link is stale either way — never fall through to
          // Share.share, which is what happened before.
          return;
        }
        return;
      }
    }
    await Share.share({
      message: `Join "${trip.name}" on Jernie: ${inviteLink}`,
      url: inviteLink,
    });
  };

  const handleSignOut = async () => {
    await signOut();
    // A fresh anonymous uid can't read this trip (database.rules.json:18) — leaving the
    // user mounted here would keep rendering the stale trip name and invite link until the
    // next refetch throws. `/` re-derives where a uid with no trips belongs (onboarding),
    // rather than assuming My Trips like the trip-deletion path below.
    router.replace('/');
  };

  const handleDeleteAccount = () => {
    confirmDelete({
      title: 'Delete account?',
      message: "This permanently deletes your account. Trips you own move to Recently Deleted; you won't be able to sign back into this account.",
      confirmLabel: 'Delete account',
      onConfirm: () => {
        deleteAccount()
          .then(() => router.replace('/'))
          .catch(() => setAccountError("Couldn't delete your account. Try again."));
      },
    });
  };

  const handleSave = async () => {
    if (saveDisabled) return;
    try {
      await updateTrip(trip.id, { name });
      setTripError(null);
      refetch();
    } catch {
      setTripError("Couldn't save the trip name. Try again.");
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
          .catch(() => setTripError("Couldn't delete this trip. Try again."));
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {status === 'authenticated' ? (
          <>
            <Text style={styles.accountIdentity}>{user?.email ?? user?.displayName ?? 'Signed in'}</Text>
            <TouchableOpacity testID="profile-signout" onPress={() => { void handleSignOut(); }}>
              <Text style={styles.accountAction}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="profile-delete-account" onPress={handleDeleteAccount}>
              <Text style={styles.accountDanger}>Delete account</Text>
            </TouchableOpacity>
            {accountError && <Text style={styles.errorText}>{accountError}</Text>}
          </>
        ) : (
          <>
            <Text style={styles.accountIdentity}>This trip lives only on this phone.</Text>
            <TouchableOpacity testID="profile-signin" onPress={() => { void handleSignIn(); }}>
              <Text style={styles.accountAction}>Sign in with Apple</Text>
            </TouchableOpacity>
            {accountError && <Text style={styles.errorText}>{accountError}</Text>}
          </>
        )}
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

          {tripError && <Text style={styles.errorText}>{tripError}</Text>}

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

  section: {
    marginTop: Spacing.xxl,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: { ...Typography.roles.label, color: Core.textMuted },
  accountIdentity: { ...Typography.roles.body, color: Core.text, textAlign: 'center' },
  accountAction: { ...Typography.roles.button, color: Core.action },
  accountDanger: { ...Typography.roles.button, color: Semantic.error },

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
