import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { useTripContext } from '@/src/contexts/TripContext';
import { getDefaultDayForStop } from '@/src/domain/explore';
import { getDevNow } from '@/src/utils/devTime';
import { formatDayLabel } from '@/src/utils/dates';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';
import type { ItineraryDay } from '@/src/types';

export interface DayPickerPayload {
  stopId: string;
  onPick: (day: ItineraryDay) => void;
}

export type DayPickerSheetRef = {
  present: (payload: DayPickerPayload) => void;
  dismiss: () => void;
};

type Scope = 'stop' | 'all';

// Same values StopFormSheet uses. @gorhom/bottom-sheet's SpringConfig type omits the two
// rest thresholds even though the runtime honors them; the assertion keeps the values.
const SHEET_SPRING = {
  damping: 60,
  stiffness: 180,
  mass: 1.2,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
} as Parameters<typeof useBottomSheetSpringConfigs>[0];

function itemCountLabel(day: ItineraryDay): string {
  const n = day.items.length;
  if (n === 0) return 'No items';
  return `${n} item${n === 1 ? '' : 's'}`;
}

/**
 * Lets the user choose which itinerary day something lands on, replacing Explore's previous
 * silent auto-pick (which offered no choice and failed invisibly when a stop had no days).
 *
 * Reads `stops`/`itinerary` from `useTripContext()` rather than taking them as props — it is
 * always rendered inside a `TripProvider`, and this keeps call sites to a single line. Past
 * days stay visible but non-interactive: seeing them is useful orientation, picking them is not.
 */
export const DayPickerSheet = React.forwardRef<DayPickerSheetRef, object>((_, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);
  const { stops, itinerary } = useTripContext();

  const [payload, setPayload] = useState<DayPickerPayload | null>(null);
  const [scope, setScope] = useState<Scope>('stop');

  const todayIso = getDevNow().toISOString().split('T')[0];

  const animationConfigs = useBottomSheetSpringConfigs(SHEET_SPRING);

  useImperativeHandle(ref, () => ({
    present(next: DayPickerPayload) {
      setPayload(next);
      // Scope is per-invocation, not sticky — a previous "All stops" browse shouldn't
      // silently widen the next pick.
      setScope('stop');
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
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      opacity={0.45}
    />
  ), []);

  const defaultDayId = payload ? getDefaultDayForStop(itinerary, payload.stopId)?.id ?? null : null;

  // One shape for both scopes: a list of (stop, days) sections. In "this stop" scope it holds
  // exactly one section and the header is suppressed.
  const sections = useMemo(() => {
    if (!payload) return [];
    if (scope === 'stop') {
      const stop = stops.find(s => s.id === payload.stopId);
      return [{ stopId: payload.stopId, city: stop?.city ?? '', color: stop?.color ?? Core.action, days: itinerary[payload.stopId] ?? [] }];
    }
    return stops
      .map(s => ({ stopId: s.id, city: s.city, color: s.color, days: itinerary[s.id] ?? [] }))
      .filter(section => section.days.length > 0);
  }, [payload, scope, stops, itinerary]);

  const hasAnyDay = sections.some(section => section.days.length > 0);

  // The past-day guard lives here as well as on `disabled` so it holds no matter how the
  // press arrives — `disabled` only governs the touch path.
  const handlePick = useCallback((day: ItineraryDay) => {
    if (day.dateIso < todayIso) return;
    payload?.onPick(day);
    modalRef.current?.dismiss();
  }, [payload, todayIso]);

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
      <BottomSheetScrollView contentContainerStyle={s.content}>
        {payload && (
          <>
            <Text style={s.title}>Add to which day?</Text>

            <View style={s.scopeRow}>
              <TouchableOpacity
                testID="day-picker-scope-stop"
                style={[s.scopeButton, scope === 'stop' && s.scopeButtonActive]}
                onPress={() => setScope('stop')}
              >
                <Text style={[s.scopeText, scope === 'stop' && s.scopeTextActive]}>This stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="day-picker-scope-all"
                style={[s.scopeButton, scope === 'all' && s.scopeButtonActive]}
                onPress={() => setScope('all')}
              >
                <Text style={[s.scopeText, scope === 'all' && s.scopeTextActive]}>All stops</Text>
              </TouchableOpacity>
            </View>

            {!hasAnyDay && <Text style={s.emptyText}>No days on this stop's itinerary yet.</Text>}

            {sections.map(section => (
              <View key={section.stopId}>
                {scope === 'all' && <Text style={s.sectionHeader}>{section.city}</Text>}
                {section.days.map(day => {
                  const isPast = day.dateIso < todayIso;
                  const isToday = day.dateIso === todayIso;
                  return (
                    <TouchableOpacity
                      key={day.id}
                      testID={`day-picker-row-${day.id}`}
                      style={[
                        s.dayRow,
                        isPast && s.dayRowPast,
                        day.id === defaultDayId && { borderColor: hexWithAlpha(section.color, 0.5) },
                      ]}
                      disabled={isPast}
                      onPress={() => handlePick(day)}
                    >
                      <View style={s.dayRowText}>
                        <Text style={[s.dayLabel, isPast && s.dayLabelPast]}>{formatDayLabel(day.dateIso)}</Text>
                        <Text style={s.dayMeta}>{itemCountLabel(day)}</Text>
                      </View>
                      {isToday && (
                        <View testID="day-picker-today-badge" style={[s.todayBadge, { backgroundColor: hexWithAlpha(section.color, 0.12) }]}>
                          <Text style={[s.todayBadgeText, { color: section.color }]}>Today</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.textFaint, width: 44, height: 5 },
  background: { backgroundColor: Core.surface, borderRadius: 24 },
  content:    { padding: Spacing.lg, paddingBottom: 32 },
  title: {
    ...Typography.roles.title,
    color: Core.text,
    marginBottom: Spacing.base,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  scopeButton: {
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
  },
  scopeButtonActive: {
    backgroundColor: Core.action,
    borderColor: Core.action,
  },
  scopeText: {
    ...Typography.roles.chip,
    color: Core.textMuted,
  },
  scopeTextActive: { color: Core.white },
  sectionHeader: {
    ...Typography.roles.caps,
    color: Core.textFaint,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    ...Typography.roles.sub,
    color: Core.textMuted,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Core.surface,
    borderWidth: 1,
    borderColor: Core.border,
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dayRowPast: { opacity: 0.45 },
  dayRowText: { flex: 1 },
  dayLabel: {
    ...Typography.roles.body,
    color: Core.text,
  },
  dayLabelPast: { color: Core.textMuted },
  dayMeta: {
    ...Typography.roles.sub,
    color: Core.textFaint,
    marginTop: 1,
  },
  todayBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  todayBadgeText: { ...Typography.roles.caps },
});
