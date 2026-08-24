import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { addCustomItineraryItem, updateItineraryItem, removeItineraryItem } from '@/src/lib/itineraryWrites';
import type { CustomItineraryItemInput } from '@/src/domain/itinerary';
import { confirmDelete } from '@/src/utils/confirmDelete';
import { formatDayLabel } from '@/src/utils/dates';
import { DayPickerSheet } from './DayPickerSheet';
import type { DayPickerSheetRef } from './DayPickerSheet';
import { iconFor, type ItemCategory } from '@/src/design/icons';
import { ROLE_ORDER } from '@/src/domain/agenda';
import { normalizeCategory, ROLE_OF_CATEGORY } from '@/src/domain/taxonomy';
import { Animation, Core, Radius, Semantic, Spacing, Typography } from '@/src/design/tokens';
import { Chip } from '@/src/ui';
import type { ItineraryDay, ItineraryItem } from '@/src/types';

export interface CustomItemPayload {
  stopId: string;
  /** Omit when the entry point knows only the stop — the day picker resolves it. */
  day?: ItineraryDay;
  /** When provided, the sheet edits (and offers removal of) this item instead of adding one. */
  editingItem?: ItineraryItem;
}

export type CustomItemSheetRef = {
  present: (payload: CustomItemPayload) => void;
  dismiss: () => void;
};

interface CustomItemSheetProps {
  tripId: string;
  /** Called after a successful add, edit, or remove — e.g. to refetch the trip. */
  onSaved: () => void;
}

// `spring-drag` is the token for a sheet detent, and the same one StopFormSheet and the
// detail sheet use. It replaces a hand-tuned config carrying two keys Reanimated 4's
// `SpringConfig` does not have, kept alive by an `as` cast.
const SHEET_SPRING = Animation.springs.drag;

/**
 * **The canonical ten, ordered by role.**
 *
 * This picker used to offer seven legacy spellings — `restaurant`, `bar`, `transport`,
 * `other` — none of which are what the rest of the app reasons in. Session 5 widened
 * `ItineraryItemCategory` to reach the canonical set but left no writer offering it; this is
 * that writer. Two of the additions matter beyond tidiness: `stay` is how you say *staying
 * with friends* and `car` is how you say *driving my own car*, and without them
 * `src/domain/gaps.ts` reports a permanent stay gap and a permanent transport gap on stops
 * that are perfectly well covered.
 *
 * There is no "Other" chip: pressing the selected chip clears the category, which is the
 * same thing and one fewer value in the data.
 */
const CATEGORY_LABEL: Record<ItemCategory, string> = {
  flight: 'Flight', transit: 'Transit', car: 'Car',
  stay: 'Stay',
  food: 'Food', bars: 'Drinks',
  hike: 'Hike', activity: 'Activity', sight: 'Sight', shopping: 'Shopping',
};

// Grouped the way Agenda groups: how you get there, where you sleep, where you eat, what
// you do. A flat alphabetical list of ten put Shopping between Sight and Stay.
const CATEGORIES: ItemCategory[] = ROLE_ORDER.flatMap(role =>
  (Object.keys(CATEGORY_LABEL) as ItemCategory[]).filter(c => ROLE_OF_CATEGORY[c] === role));

/**
 * Add/edit sheet for free-text itinerary items — the UI over Phase 1's `itineraryWrites`.
 *
 * Day resolution is the wrinkle: the "Log activity" entry point knows only the stop, so this
 * component owns its own `DayPickerSheet` and presents it when `present()` arrives without a
 * day. Submit stays disabled until a day is resolved, and the chosen date is shown above the
 * form so the item's destination is never implicit.
 */
export const CustomItemSheet = React.forwardRef<CustomItemSheetRef, CustomItemSheetProps>(({ tripId, onSaved }, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const dayPickerRef = useRef<DayPickerSheetRef>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);

  const [payload, setPayload] = useState<CustomItemPayload | null>(null);
  const [day, setDay] = useState<ItineraryDay | null>(null);
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const animationConfigs = useBottomSheetSpringConfigs(SHEET_SPRING);

  const openDayPicker = useCallback((stopId: string) => {
    dayPickerRef.current?.present({ stopId, onPick: setDay });
  }, []);

  useImperativeHandle(ref, () => ({
    present(next: CustomItemPayload) {
      // Every field is reset from the incoming payload, so a prior edit never bleeds into
      // the next add through this shared sheet instance.
      setPayload(next);
      setDay(next.day ?? null);
      setLabel(next.editingItem?.label ?? '');
      setTime(next.editingItem?.time ?? '');
      // Normalised on the way in, so an item stored as `restaurant` shows the Food chip
      // selected rather than nothing, and saving migrates it to the canonical spelling.
      setCategory(normalizeCategory(next.editingItem?.category));
      setNotes(next.editingItem?.notes ?? '');
      setSubmitError(null);
      modalRef.current?.present();
      if (!next.day) openDayPicker(next.stopId);
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

  const canSubmit = label.trim() !== '' && day !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !day || !payload) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Blank optionals are omitted rather than written as empty strings.
      const input: CustomItineraryItemInput = {
        label: label.trim(),
        ...(time.trim()  ? { time: time.trim() }   : {}),
        ...(category     ? { category }            : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      if (payload.editingItem) {
        await updateItineraryItem(tripId, day, payload.editingItem.id, input);
      } else {
        await addCustomItineraryItem(tripId, day, input);
      }
      onSaved();
      modalRef.current?.dismiss();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save this item — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = useCallback(() => {
    const editing = payload?.editingItem;
    if (!editing || !day) return;
    confirmDelete({
      title: 'Remove item?',
      message: "This removes it from this day's itinerary.",
      onConfirm: () => {
        removeItineraryItem(tripId, day, editing.id)
          .then(() => { onSaved(); modalRef.current?.dismiss(); })
          .catch(() => {});
      },
    });
  }, [payload, day, tripId, onSaved]);

  return (
    <>
      <BottomSheetModal
        ref={modalRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        onChange={handleChange}
        animationConfigs={animationConfigs}
        handleIndicatorStyle={s.handle}
        backgroundStyle={s.background}
      >
        <BottomSheetScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {payload && (
            <>
              <Text style={s.title}>{payload.editingItem ? 'Edit item' : 'Add to itinerary'}</Text>

              <TouchableOpacity
                testID="custom-item-change-day"
                style={s.dayRow}
                onPress={() => openDayPicker(payload.stopId)}
              >
                <Text style={s.dayLabel}>{day ? formatDayLabel(day.dateIso) : 'Pick a day'}</Text>
                <Text style={s.dayAction}>Change</Text>
              </TouchableOpacity>

              <Text style={s.label}>What</Text>
              <TextInput
                testID="custom-item-label"
                style={s.input}
                value={label}
                onChangeText={text => { setLabel(text); setSubmitError(null); }}
                placeholder="e.g. Ferry to Peaks Island"
                placeholderTextColor={Core.textFaint}
              />

              <Text style={[s.label, s.spacedLabel]}>Time</Text>
              <TextInput
                testID="custom-item-time"
                style={s.input}
                value={time}
                onChangeText={text => { setTime(text); setSubmitError(null); }}
                placeholder="Optional, e.g. 7:15 PM"
                placeholderTextColor={Core.textFaint}
              />

              <Text style={[s.label, s.spacedLabel]}>Category</Text>
              <View style={s.chipRow}>
                {CATEGORIES.map(value => {
                  const selected = category === value;
                  const Glyph = iconFor(value);
                  return (
                    <Chip
                      key={value}
                      testID={`custom-item-category-${value}`}
                      label={CATEGORY_LABEL[value]}
                      icon={<Glyph size={13} color={selected ? Core.white : Core.textMuted} weight="fill" />}
                      selected={selected}
                      // Pressing the selected chip clears it — category is optional and
                      // there is no other way back to "none" once one is chosen.
                      onPress={() => setCategory(selected ? null : value)}
                    />
                  );
                })}
              </View>

              <Text style={[s.label, s.spacedLabel]}>Notes</Text>
              <TextInput
                testID="custom-item-notes"
                style={[s.input, s.notesInput]}
                value={notes}
                onChangeText={text => { setNotes(text); setSubmitError(null); }}
                placeholder="Optional"
                placeholderTextColor={Core.textFaint}
                multiline
              />

              {submitError && <Text testID="custom-item-error" style={s.errorText}>{submitError}</Text>}

              <View style={s.actions}>
                <TouchableOpacity
                  testID="custom-item-cancel"
                  style={s.cancelButton}
                  onPress={() => modalRef.current?.dismiss()}
                >
                  <Text style={s.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="custom-item-submit"
                  style={[s.submitButton, !canSubmit && s.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                >
                  {submitting ? (
                    <ActivityIndicator color={Core.white} size="small" />
                  ) : (
                    <Text style={s.submitButtonText}>{payload.editingItem ? 'Save changes' : 'Add item'}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {payload.editingItem && (
                <TouchableOpacity testID="custom-item-remove" style={s.removeButton} onPress={handleRemove}>
                  <Text style={s.removeButtonText}>Remove item</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <DayPickerSheet ref={dayPickerRef} />
    </>
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
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.base,
  },
  dayLabel: {
    ...Typography.roles.body,
    color: Core.text,
  },
  dayAction: {
    ...Typography.roles.chip,
    color: Core.action,
  },
  label: {
    ...Typography.roles.chip,
    color: Core.textMuted,
    marginBottom: Spacing.sm,
  },
  spacedLabel: { marginTop: Spacing.base },
  input: {
    ...Typography.roles.body,
    color: Core.text,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  errorText: {
    ...Typography.roles.sub,
    color: Semantic.error,
    marginTop: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  cancelButtonText: {
    ...Typography.roles.button,
    color: Core.textMuted,
  },
  submitButton: {
    backgroundColor: Core.action,
    borderRadius: Radius.icon,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: {
    ...Typography.roles.button,
    color: Core.white,
  },
  removeButton: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    backgroundColor: Semantic.errorSoft,
    borderWidth: 1,
    borderColor: Semantic.error,
    borderRadius: Radius.icon,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  removeButtonText: {
    ...Typography.roles.button,
    color: Semantic.error,
  },
});
