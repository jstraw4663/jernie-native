import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { useBooking } from '@/src/hooks/useBooking';
import { confirmDelete } from '@/src/utils/confirmDelete';
import { BookingForm, type BookingFormValues } from '@/src/features/jernie/BookingForm';
import { Core, Semantic, Typography, Radius, Spacing } from '@/src/design/tokens';
import type { NewBooking, BookingPatch } from '@/src/lib/bookingWrites';
import type { Booking, BookingType } from '@/src/types';

export interface BookingSheetPayload {
  type: BookingType;
  stopId: string;
  /** When provided, the sheet edits (and offers removal of) this booking instead of adding one. */
  editingBooking?: Booking;
}

export type BookingFormSheetRef = {
  present: (payload: BookingSheetPayload) => void;
  dismiss: () => void;
};

interface BookingFormSheetProps {
  tripId: string;
  /** Called after a successful add, edit, or remove — e.g. to refetch the trip. */
  onSaved: () => void;
}

// Same values StopFormSheet uses, so both sheets animate identically. @gorhom/bottom-sheet's
// SpringConfig type omits the two rest thresholds even though the runtime honors them; the
// assertion keeps the values without adding to the file's typing-error count.
const SHEET_SPRING = {
  damping: 60,
  stiffness: 180,
  mass: 1.2,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
} as Parameters<typeof useBottomSheetSpringConfigs>[0];

const TYPE_LABEL: Record<BookingType, string> = {
  flight: 'flight',
  hotel: 'stay',
  rental: 'rental car',
  restaurant: 'restaurant',
};

/** The form's value shape is the booking minus the keys the sheet already knows. */
function toFormValues(booking: Booking): BookingFormValues {
  const { id: _id, tripId: _tripId, stopId: _stopId, ...values } = booking;
  return values as BookingFormValues;
}

/**
 * Bottom-sheet wrapper around `BookingForm`. Unlike `StopFormSheet` — whose mode is fixed by a
 * prop — the type/stop/booking here varies per invocation, so the payload rides on `present()`,
 * matching `EntityDetailSheet`'s pattern. Everything else (backdrop, spring configs, the
 * `SheetContext` open-count, dynamic sizing) is `StopFormSheet`'s chrome unchanged.
 *
 * All RTDB-write logic lives in `useBooking()`; `BookingForm` itself has no RTDB or bottom-sheet
 * knowledge, which is what keeps it reusable outside a sheet.
 */
export const BookingFormSheet = React.forwardRef<BookingFormSheetRef, BookingFormSheetProps>(({ tripId, onSaved }, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);
  const { addBooking, updateBooking, removeBooking } = useBooking();

  const [payload, setPayload] = useState<BookingSheetPayload | null>(null);
  // Bumped on every present() and used as the form's `key`, so each presentation gets a
  // freshly-mounted form. Without it, BookingForm's useState seeds would survive from the
  // previous payload and a prior edit's values would bleed into the next add.
  const [presentation, setPresentation] = useState(0);

  const animationConfigs = useBottomSheetSpringConfigs(SHEET_SPRING);

  useImperativeHandle(ref, () => ({
    present(next: BookingSheetPayload) {
      setPayload(next);
      setPresentation(n => n + 1);
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

  const handleCancel = useCallback(() => {
    modalRef.current?.dismiss();
  }, []);

  // Left unwrapped (no try/catch) — a rejection propagates back to BookingForm, which shows the
  // inline error and re-enables its submit button so the user can retry without re-typing.
  const handleSubmit = useCallback(async (booking: NewBooking) => {
    if (payload?.editingBooking) {
      // `type` is immutable once created and is excluded from BookingPatch — a booking can't
      // change kind — and `stopId` is fixed by where the sheet was opened from.
      const { type: _type, stopId: _stopId, ...patch } = booking;
      await updateBooking(tripId, payload.editingBooking.id, patch as BookingPatch);
    } else {
      await addBooking(tripId, booking);
    }
    onSaved();
    modalRef.current?.dismiss();
  }, [payload, tripId, addBooking, updateBooking, onSaved]);

  const handleRemove = useCallback(() => {
    const editing = payload?.editingBooking;
    if (!editing) return;
    confirmDelete({
      title: 'Remove booking?',
      message: 'This removes it from your trip and from any itinerary day it appears on.',
      onConfirm: () => {
        removeBooking(tripId, editing.id)
          .then(() => { onSaved(); modalRef.current?.dismiss(); })
          .catch(() => {});
      },
    });
  }, [payload, removeBooking, tripId, onSaved]);

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
        {payload && (
          <>
            <Text style={s.title}>
              {payload.editingBooking ? 'Edit' : 'Add'} {TYPE_LABEL[payload.type]}
            </Text>
            <BookingForm
              key={presentation}
              type={payload.type}
              stopId={payload.stopId}
              initialValues={payload.editingBooking ? toFormValues(payload.editingBooking) : undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              submitLabel={payload.editingBooking ? 'Save changes' : 'Add booking'}
            />
            {payload.editingBooking && (
              <TouchableOpacity testID="remove-booking-button" style={s.removeButton} onPress={handleRemove}>
                <Text style={s.removeButtonText}>Remove booking</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.textFaint, width: 44, height: 5 },
  background: { backgroundColor: Core.bg, borderRadius: 24 },
  content:    { paddingBottom: 24 },
  title: {
    ...Typography.roles.h2,
    color: Core.text,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  removeButton: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    backgroundColor: Semantic.errorTint,
    borderWidth: 1,
    borderColor: Semantic.error,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  removeButtonText: {
    ...Typography.roles.button,
    color: Semantic.error,
  },
});
