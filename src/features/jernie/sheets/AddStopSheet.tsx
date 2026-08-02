import React, { useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, useBottomSheetSpringConfigs } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { useAddStop } from '@/src/hooks/useAddStop';
import { StopForm, type ResolvedStop } from '@/src/features/jernie/StopForm';
import { Core } from '@/src/design/tokens';

export type AddStopSheetRef = {
  present: () => void;
  dismiss: () => void;
};

interface AddStopSheetProps {
  tripId: string;
  /** Called after addStop() resolves and the sheet has been dismissed — e.g. to refetch the trip. */
  onAdded: () => void;
}

/**
 * Bottom-sheet wrapper around the shared `StopForm`, presented from `StopsStrip`'s trailing "+"
 * pill. Mirrors `EntityDetailSheet.tsx`'s `BottomSheetModal` + imperative ref pattern (including
 * participating in `SheetContext`'s open-sheet count), but deliberately does NOT plumb into
 * `EntityDetailSheet`'s multi-kind payload system — that system is for viewing place/hike/hotel/
 * flight details, a different concern from a data-entry form. Uses dynamic sizing (no fixed
 * `snapPoints`) since the form's content height is small and fixed, unlike the detail sheets.
 *
 * All RTDB-write logic lives in `useAddStop()`; this component's only job is presentation —
 * `StopForm` itself has no RTDB or bottom-sheet knowledge, which is what keeps it reusable for
 * Task 5's wizard step (a plain screen, not a sheet).
 */
export const AddStopSheet = React.forwardRef<AddStopSheetRef, AddStopSheetProps>(({ tripId, onAdded }, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);
  const { addStop } = useAddStop();

  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 60,
    stiffness: 180,
    mass: 1.2,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  });

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
    await addStop(tripId, resolved);
    onAdded();
    modalRef.current?.dismiss();
  }, [addStop, tripId, onAdded]);

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
        <StopForm onSubmit={handleSubmit} onCancel={handleCancel} submitLabel="Add stop" />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.textFaint, width: 44, height: 5 },
  background: { backgroundColor: Core.bg, borderRadius: 24 },
  content:    { paddingBottom: 24 },
});
