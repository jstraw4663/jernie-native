import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Core, Semantic, Typography, Spacing, Radius } from '@/src/design/tokens';
import { useTripContext } from '@/src/contexts/TripContext';
import { useConnectivityState } from '@/src/contexts/ConnectivityContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { useAdminUnlock } from '@/src/contexts/AdminUnlockContext';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';
import { useCollisionSignIn } from '@/src/hooks/useCollisionSignIn';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { confirmDelete } from '@/src/utils/confirmDelete';
import { updateDisplayName } from '@/src/lib/userProfile';
import { getActiveStopId } from '@/src/domain/trip';
import { getDevNow } from '@/src/utils/devTime';
import { getCacheStatus, getMemberRole } from '@/src/domain/profile';
import { ProfileHeader } from '@/src/features/jernie/profile/ProfileHeader';
import { YouCard } from '@/src/features/jernie/profile/YouCard';
import { TravelerRail } from '@/src/features/jernie/profile/TravelerRail';
import { SettingsCard } from '@/src/features/jernie/profile/SettingsCard';
import { SettingsRow } from '@/src/features/jernie/profile/SettingsRow';
import { CacheCard, type CacheRow } from '@/src/features/jernie/profile/CacheCard';
import { VersionRow } from '@/src/features/jernie/profile/VersionRow';
import { AdminPanel } from '@/src/features/jernie/profile/AdminPanel';
import { MemberSheet, type MemberSheetRef } from '@/src/features/jernie/sheets/MemberSheet';
import { FeedbackSheet, type FeedbackSheetRef } from '@/src/features/jernie/sheets/FeedbackSheet';

export default function ProfileTab() {
  const router = useRouter();
  const { trip, stops, members, groups, currentUid, places, enrichment, fromCache, cachedAt, status: tripStatus, refetch } = useTripContext();
  const { pendingWriteCount, isOnline } = useConnectivityState();
  const { updateTrip, archiveTrip } = useTripAdmin();

  // Two independent error slots. A single shared one rendered in both the Account block and
  // the owner-only trip-settings block, so one failed sign-in printed the same message twice
  // on screen — under Account and again under Save.
  const [accountError, setAccountError] = useState<string | null>(null);
  const [tripError, setTripError] = useState<string | null>(null);
  const [name, setName] = useState(trip.name);
  const inviteLink = `jernie://join/${trip.inviteToken}`;

  const { status, user, signInWithApple, signOut, deleteAccount } = useAuth();
  const adoptOnCollision = useCollisionSignIn();
  const profile = useUserProfile(currentUid);
  const { unlocked, lock } = useAdminUnlock();

  const memberSheetRef = useRef<MemberSheetRef>(null);
  const feedbackSheetRef = useRef<FeedbackSheetRef>(null);

  // `user` from useAuth(), not auth().currentUser read directly — the latter is
  // non-reactive (no re-render on change) and reads stale/false during the brief window a
  // delete or sign-out is in flight and the uid has already moved on underneath it.
  const isOwner = trip.ownerUid === user?.uid;

  const accentColor = useMemo(() => {
    const activeId = getActiveStopId(stops, getDevNow());
    return stops.find(s => s.id === activeId)?.color ?? stops[0]?.color ?? Core.action;
  }, [stops]);

  const role = getMemberRole(members, currentUid);
  // displayName is the renameable one. It falls back to the member handle, which is
  // denormalized at join time and write-once by rule — see the rename note below.
  const myHandle = members.find(m => m.uid === currentUid)?.handle ?? '';
  const displayName = profile.displayName ?? myHandle;

  const cacheRows: CacheRow[] = useMemo(() => {
    const trip = getCacheStatus({ fromCache, status: tripStatus, cachedAt, now: Date.now() });
    const withCoords = places.filter(p => p.lat != null && p.lon != null).length;
    return [
      { label: 'Trip data', state: trip.state, detail: trip.label },
      {
        label: 'Place details',
        // Places without coordinates can never resolve an enrichment key at all, so
        // "0 of 12" here is the honest answer rather than an error — see known-issues.md.
        state: withCoords === 0 ? 'stale' : Object.keys(enrichment).length > 0 ? 'live' : 'connecting',
        detail: `${Object.keys(enrichment).length} of ${withCoords} lookups cached`,
      },
      {
        label: 'Pending changes',
        state: pendingWriteCount === 0 ? 'live' : isOnline ? 'connecting' : 'stale',
        detail: pendingWriteCount === 0
          ? 'Everything saved'
          : `${pendingWriteCount} waiting${isOnline ? '' : ' — offline'}`,
      },
    ];
  }, [fromCache, tripStatus, cachedAt, places, enrichment, pendingWriteCount, isOnline]);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  // Moved verbatim from this screen's previous layout. Their four-branch LinkOutcome
  // handling and the early return below are each a bug fix with a commit behind it
  // (0c8dace, c99ce90, cf00082); this sprint re-lays-out the screen, it does not revisit
  // auth behaviour.

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

  // ── Profile actions ────────────────────────────────────────────────────────

  const handleRename = useCallback(async (next: string) => {
    if (!currentUid) throw new Error('Not signed in');
    await updateDisplayName(currentUid, next);
    profile.refetch();
  }, [currentUid, profile]);

  const saveDisabled = name.trim().length === 0 || name === trip.name;

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

  // `replace`, not `push`: leaving this trip should unmount its TripProvider (and the live
  // RTDB listeners it holds) rather than leaving it stacked underneath.
  const handleSwitchTrip = useCallback(() => router.replace('/(home)' as never), [router]);

  return (
    <View style={styles.container}>
      <ProfileHeader tripName={trip.name} accentColor={accentColor} onSwitchTrip={handleSwitchTrip} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <YouCard
          name={displayName}
          role={role}
          plan={profile.plan}
          accentColor={accentColor}
          // Renaming needs a durable record to rename. An anonymous user has one in RTDB, but
          // offering it before they sign in invites them to personalise an account that
          // vanishes with the device.
          onRename={status === 'authenticated' ? handleRename : undefined}
        />

        <TravelerRail
          members={members}
          currentUid={currentUid}
          accentColor={accentColor}
          onSelect={member => memberSheetRef.current?.present(member)}
        />

        <SettingsCard
          title="Account"
          footer={accountError ? <Text style={styles.errorText}>{accountError}</Text> : undefined}
        >
          {status === 'authenticated' ? (
            <SettingsRow
              icon="👤"
              label={user?.email ?? profile.email ?? displayName ?? 'Signed in'}
              sublabel="Your trips are saved to this account"
              testID="profile-account-row"
            />
          ) : (
            <SettingsRow
              icon="🔒"
              label="Sign in with Apple"
              sublabel="This trip lives only on this phone"
              onPress={() => { void handleSignIn(); }}
              testID="profile-signin"
            />
          )}

          <SettingsRow
            icon="✉️"
            label="Invite travellers"
            sublabel={status === 'authenticated' ? inviteLink : 'Sign in first — an invite outlives your phone'}
            onPress={() => { void handleShareInvite(); }}
            testID="share-invite-button"
          />

          {status === 'authenticated' ? (
            <SettingsRow
              icon="🚪"
              label="Sign out"
              onPress={() => { void handleSignOut(); }}
              testID="profile-signout"
            />
          ) : null}

          {status === 'authenticated' ? (
            <SettingsRow
              icon="⚠️"
              label="Delete account"
              destructive
              onPress={handleDeleteAccount}
              testID="profile-delete-account"
            />
          ) : null}
        </SettingsCard>

        {isOwner && (
          <SettingsCard
            title="Trip"
            footer={tripError ? <Text style={styles.errorText}>{tripError}</Text> : undefined}
          >
            {/* Kept as an always-visible field rather than a row that opens a sheet. One text
                input does not need a modal, and the inline form is what the existing
                owner-only test suite exercises. */}
            <View style={styles.tripNameBlock}>
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
            </View>
            <SettingsRow
              icon="🗑️"
              label="Delete trip"
              sublabel="Moves to Recently Deleted"
              destructive
              onPress={handleDelete}
              testID="delete-trip-button"
            />
          </SettingsCard>
        )}

        <CacheCard rows={cacheRows} />

        <VersionRow onFeedback={() => feedbackSheetRef.current?.present()} />
      </ScrollView>

      <MemberSheet ref={memberSheetRef} groups={groups} currentUid={currentUid} accentColor={accentColor} />
      <FeedbackSheet ref={feedbackSheetRef} tripId={trip.id} />

      <AdminPanel
        visible={unlocked}
        onClose={lock}
        cachedAt={cachedAt}
        fromCache={fromCache}
        places={places}
        enrichment={enrichment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  errorText: { ...Typography.roles.meta, color: Semantic.error },

  tripNameBlock: { padding: Spacing.base, gap: Spacing.sm },
  settingsLabel: { ...Typography.roles.label, color: Core.textMuted },
  nameInput: {
    ...Typography.roles.body,
    color: Core.text,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  saveButton: {
    alignSelf: 'flex-start',
    backgroundColor: Core.action,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...Typography.roles.button, color: Core.textInverse },
});
