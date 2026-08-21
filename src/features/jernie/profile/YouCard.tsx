import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Core, Semantic, Radius, Shadow, Spacing, Typography } from '@/src/design/tokens';
import { getPlanBadge, type PlanBadge } from '@/src/domain/profile';
import { Avatar } from '@/src/features/jernie/profile/Avatar';
import type { TripMemberRole } from '@/src/types';

interface YouCardProps {
  name: string;
  role: TripMemberRole | null;
  plan: string | undefined;
  accentColor: string;
  /** Absent when signed out — an anonymous user has no durable record to rename. */
  onRename?: (name: string) => Promise<void>;
}

const ROLE_LABEL: Record<TripMemberRole, string> = {
  organizer: 'Organizer',
  traveler: 'Traveller',
};

export function YouCard({ name, role, plan, accentColor, onRename }: YouCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const badge: PlanBadge = getPlanBadge(plan);
  const badgeColor = badge.tone === 'accent' ? accentColor : Core.textMuted;

  const startEdit = () => {
    setDraft(name);
    setError(null);
    setEditing(true);
  };

  const commit = async () => {
    if (!onRename) return;
    const next = draft.trim();
    // Nothing to write, and nothing to report — closing silently is the right no-op.
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(next);
      setEditing(false);
      setError(null);
    } catch {
      // Stay open with the draft intact. Closing would discard what they typed and leave
      // them with no idea the write failed.
      setError("Couldn't save that name. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, Shadow.cardResting]}>
      <View style={styles.top}>
        {/* The draft feeds the avatar while editing, so initials track what is being typed. */}
        <Avatar name={editing ? draft : name} size={52} color={accentColor} />

        <View style={styles.identity}>
          {editing ? (
            <TextInput
              testID="display-name-input"
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => { void commit(); }}
              autoFocus
              returnKeyType="done"
              maxLength={60}
              editable={!saving}
            />
          ) : (
            <Text style={styles.name} numberOfLines={1}>{name || 'You'}</Text>
          )}

          <View style={styles.metaRow}>
            {role ? <Text style={styles.role}>{ROLE_LABEL[role]}</Text> : null}
            <View style={[styles.planPill, { borderColor: `${badgeColor}55`, backgroundColor: `${badgeColor}14` }]}>
              <Text style={[styles.planText, { color: badgeColor }]}>{badge.label}</Text>
            </View>
          </View>
        </View>

        {onRename ? (
          <Pressable
            testID={editing ? 'display-name-save' : 'display-name-edit'}
            onPress={() => { editing ? void commit() : startEdit(); }}
            disabled={saving}
            hitSlop={8}
          >
            <Text style={[styles.action, { color: accentColor }]}>
              {editing ? (saving ? 'Saving…' : 'Save') : 'Edit'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Core.surface,
    borderRadius: Radius.card,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  identity: { flex: 1, gap: Spacing.xs },
  name: { ...Typography.roles.h3, color: Core.text },
  input: {
    ...Typography.roles.h3,
    color: Core.text,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  role: { ...Typography.roles.meta, color: Core.textMuted },
  planPill: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
  planText: { ...Typography.roles.labelCaps, fontSize: 10, letterSpacing: 0.8 },
  action: { ...Typography.roles.button },
  error: { ...Typography.roles.meta, color: Semantic.error },
});
