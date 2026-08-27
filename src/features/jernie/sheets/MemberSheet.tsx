import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { Avatar } from '@/src/features/jernie/profile/Avatar';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';
import type { Group, TripMember } from '@/src/types';

export type MemberSheetRef = {
  present: (member: TripMember) => void;
  dismiss: () => void;
};

interface MemberSheetProps {
  /** Every group on the trip — the sheet picks out the ones the presented member is in. */
  groups: Group[];
  currentUid: string | null;
  accentColor: string;
}

// Same values the other sheets use, so all of them animate identically. @gorhom's SpringConfig
// type omits the two rest thresholds even though the runtime honors them.
const SHEET_SPRING = {
  damping: 60,
  stiffness: 180,
  mass: 1.2,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
} as Parameters<typeof useBottomSheetSpringConfigs>[0];

const ROLE_LABEL: Record<TripMember['role'], string> = {
  organizer: 'Organizer',
  traveler: 'Traveller',
};

function formatJoined(joinedAt: number): string {
  return new Date(joinedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Read-only member detail.
 *
 * There is deliberately no "remove from trip" action: membership is write-once by rule
 * (`members/$uid` requires `!data.exists()`), so removal needs a rules change. It is logged in
 * docs/superpowers/known-issues.md as a pre-launch blocker rather than half-built here.
 */
export const MemberSheet = React.forwardRef<MemberSheetRef, MemberSheetProps>(({ groups, currentUid, accentColor }, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);
  const [member, setMember] = useState<TripMember | null>(null);

  const animationConfigs = useBottomSheetSpringConfigs(SHEET_SPRING);

  useImperativeHandle(ref, () => ({
    present(next: TripMember) {
      setMember(next);
      modalRef.current?.present();
    },
    dismiss() { modalRef.current?.dismiss(); },
  }));

  const handleChange = useCallback((index: number) => {
    if (index >= 0 && !wasOpen.current) {
      wasOpen.current = true;
      increment();
    } else if (index === -1 && wasOpen.current) {
      wasOpen.current = false;
      decrement();
    }
  }, [increment, decrement]);

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />
  ), []);

  const memberGroups = member ? groups.filter(g => g.memberUids.includes(member.uid)) : [];
  const isYou = member !== null && member.uid === currentUid;

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      animationConfigs={animationConfigs}
      handleIndicatorStyle={s.handle}
      backgroundStyle={s.background}
    >
      <BottomSheetView style={s.content}>
        {member && (
          <>
            <View style={s.header}>
              <Avatar name={member.handle} size={56} color={accentColor} />
              <View style={s.identity}>
                <Text style={s.name} numberOfLines={1}>
                  {member.handle}{isYou ? ' (you)' : ''}
                </Text>
                <Text style={s.role}>{ROLE_LABEL[member.role]}</Text>
              </View>
            </View>

            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Joined</Text>
              <Text style={s.detailValue}>{formatJoined(member.joinedAt)}</Text>
            </View>

            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Groups</Text>
              <Text style={s.detailValue} numberOfLines={3}>
                {memberGroups.length > 0
                  ? memberGroups.map(g => g.name).join(', ')
                  : 'Sees everything on this trip'}
              </Text>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

MemberSheet.displayName = 'MemberSheet';

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.textFaint, width: 44, height: 5 },
  background: { backgroundColor: Core.surface, borderRadius: 24 },
  content:    { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.base },
  header:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  identity:   { flex: 1, gap: Spacing.xxs },
  name:       { ...Typography.roles.title, color: Core.text },
  role:       { ...Typography.roles.sub, color: Core.textMuted },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Core.surface,
    borderRadius: Radius.tile,
    padding: Spacing.md,
  },
  detailLabel: { ...Typography.roles.chip, color: Core.textMuted, width: 64 },
  detailValue: { ...Typography.roles.body, color: Core.text, flex: 1, lineHeight: 22 },
});
