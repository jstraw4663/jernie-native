import React, { useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { useAddStop } from '@/src/hooks/useAddStop';
import { useEditStop } from '@/src/hooks/useEditStop';
import { confirmDelete } from '@/src/utils/confirmDelete';
import { StopForm, type ResolvedStop } from '@/src/features/jernie/StopForm';
import { Animation, Core, Radius, Semantic, Spacing, Typography } from '@/src/design/tokens';
import type { StopWithColor } from '@/src/types';

export type StopFormSheetRef = {
  present: () => void;
  dismiss: () => void;
};

interface StopFormSheetProps {
  tripId: string;
  /** When provided, the sheet edits (and offers removal of) this stop instead of adding a new one. */
  editingStop?: StopWithColor;
  /** Called after a successful add, edit, or remove and the sheet has been dismissed — e.g. to refetch the trip. */
  onSaved: () => void;
}

/**
 * Bottom-sheet wrapper around the shared `StopForm`. Presented from the stop rail's add affordance
 * pill (add mode) or from an existing stop (edit mode, via `editingStop`). Mirrors
 * `DetailSheet.tsx`'s `BottomSheetModal` + imperative ref pattern (including participating
 * in `SheetContext`'s open-sheet count), but deliberately does NOT plumb into
 * `DetailSheet`'s multi-kind payload system — that system is for viewing place/hike/hotel/
 * flight details, a different concern from a data-entry form. Uses dynamic sizing (no fixed
 * `snapPoints`) since the form's content height is small and fixed, unlike the detail sheets.
 *
 * All RTDB-write logic lives in `useAddStop()` / `useEditStop()`; this component's only job is
 * presentation — `StopForm` itself has no RTDB or bottom-sheet knowledge, which is what keeps it
 * reusable for Task 5's wizard step (a plain screen, not a sheet).
 */
export const StopFormSheet = React.forwardRef<StopFormSheetRef, StopFormSheetProps>(({ tripId, editingStop, onSaved }, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);
  const { addStop } = useAddStop();
  const { updateStop, removeStop } = useEditStop();

  // `spring-drag` is the token for a sheet detent. The hand-tuned config this replaced
  // carried two keys Reanimated 4's `SpringConfig` does not have, which is what the
  // long-standing tsc error in this file was.
  const animationConfigs = useBottomSheetSpringConfigs(Animation.springs.drag);

  useImperativeHandle(ref, () => ({
    present() { modalRef.current?.present(); },
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

  const handleCancel = useCallback(() => {
    modalRef.current?.dismiss();
  }, []);

  // Left unwrapped (no try/catch here) — a rejection propagates back to StopForm, which is what
  // shows the inline "couldn't save" error and re-enables its Continue button so the user can
  // just retry, without losing the already-resolved geocode/dates.
  const handleSubmit = useCallback(async (resolved: ResolvedStop) => {
    if (editingStop) {
      await updateStop(tripId, editingStop.id, resolved);
    } else {
      await addStop(tripId, resolved);
    }
    onSaved();
    modalRef.current?.dismiss();
  }, [editingStop, updateStop, addStop, tripId, onSaved]);

  const handleRemove = useCallback(() => {
    if (!editingStop) return;
    confirmDelete({
      title: 'Remove stop?',
      message: `This also removes ${editingStop.city}'s bookings and itinerary. This can't be undone.`,
      onConfirm: () => {
        removeStop(tripId, editingStop.id)
          .then(() => { onSaved(); modalRef.current?.dismiss(); })
          .catch(() => {});
      },
    });
  }, [editingStop, removeStop, tripId, onSaved]);

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
      <BottomSheetScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <StopForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel={editingStop ? 'Save changes' : 'Add stop'}
          initialValues={editingStop ? { city: editingStop.city, region: editingStop.region, lat: editingStop.lat, lon: editingStop.lon, dates: editingStop.dates } : undefined}
        />
        {editingStop && (
          <TouchableOpacity testID="remove-stop-button" style={s.removeButton} onPress={handleRemove}>
            <Text style={s.removeButtonText}>Remove stop</Text>
          </TouchableOpacity>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.textFaint, width: 44, height: 5 },
  background: { backgroundColor: Core.surface, borderRadius: 24 },
  content:    { paddingBottom: 24 },
  removeButton: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
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
