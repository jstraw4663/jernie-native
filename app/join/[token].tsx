import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Brand, Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { useJoinTrip } from '@/src/hooks/useJoinTrip';

export default function JoinTripScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { joinTrip, status, error } = useJoinTrip();
  const [handle, setHandle] = useState('');

  const handleJoin = async () => {
    try {
      const { tripId } = await joinTrip(token, handle);
      router.replace(`/(trips)/${tripId}/(tabs)/jernie` as never);
    } catch {
      // status/error are already surfaced via useJoinTrip's own state — nothing else to do.
    }
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invalid invite link</Text>
        <Text style={styles.sub}>This link is missing its invite code.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.eyebrow}>You've been invited</Text>
      <Text style={styles.title}>Join this trip</Text>
      <Text style={styles.sub}>Enter your name so your travel companions know who you are.</Text>

      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={handle}
        onChangeText={setHandle}
        autoFocus
        editable={status !== 'joining' && status !== 'success'}
        returnKeyType="done"
        onSubmitEditing={handleJoin}
      />

      {status === 'error' && (
        <Text style={styles.errorText}>{joinErrorMessage(error)}</Text>
      )}

      <TouchableOpacity
        style={[styles.joinButton, (status === 'joining' || status === 'success') && styles.joinButtonDisabled]}
        onPress={handleJoin}
        disabled={status === 'joining' || status === 'success'}
      >
        {status === 'joining' || status === 'success' ? (
          <ActivityIndicator color={Brand.navy} />
        ) : (
          <Text style={styles.joinButtonText}>Join trip</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

export function joinErrorMessage(error: Error | null): string {
  if (!error) return '';
  if (error.message === 'invite token not found') {
    return "This invite link isn't valid — ask for a new one.";
  }
  if ((error as { code?: string }).code === 'database/permission-denied') {
    return "Couldn't join — you may already be a member of this trip, or the link may be invalid.";
  }
  return `Couldn't join the trip: ${error.message}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.navy,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  eyebrow: {
    ...Typography.roles.labelCaps,
    color: Brand.gold,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.roles.h1,
    color: Core.white,
    marginBottom: Spacing.sm,
  },
  sub: {
    ...Typography.roles.body,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: Spacing.xl,
  },
  input: {
    ...Typography.roles.body,
    color: Core.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.base,
  },
  errorText: {
    ...Typography.roles.meta,
    color: '#F5A9B8',
    marginBottom: Spacing.base,
  },
  joinButton: {
    backgroundColor: Brand.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.7,
  },
  joinButtonText: {
    ...Typography.roles.button,
    color: Brand.navy,
  },
});
