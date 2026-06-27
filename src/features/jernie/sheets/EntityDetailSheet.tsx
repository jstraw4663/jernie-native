import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSheetContext } from '@/src/contexts/SheetContext';
import type { EntitySheetPayload } from './types';
import { RestaurantSheet } from './RestaurantSheet';
import { HikeSheet } from './HikeSheet';
import { HotelSheet } from './HotelSheet';
import { FlightSheet } from './FlightSheet';
import { Core } from '@/src/design/tokens';

export type EntityDetailSheetRef = {
  present: (payload: EntitySheetPayload) => void;
  dismiss: () => void;
};

export const EntityDetailSheet = React.forwardRef<EntityDetailSheetRef, object>((_, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const [payload, setPayload] = useState<EntitySheetPayload | null>(null);
  const { increment, decrement } = useSheetContext();
  const wasOpen = useRef(false);

  useImperativeHandle(ref, () => ({
    present(p: EntitySheetPayload) {
      setPayload(p);
      modalRef.current?.present();
    },
    dismiss() {
      modalRef.current?.dismiss();
    },
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

  const handleClose = useCallback(() => {
    modalRef.current?.dismiss();
  }, []);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={['95%']}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      handleIndicatorStyle={s.handle}
      backgroundStyle={s.background}
    >
      {payload?.kind === 'restaurant' && (
        <RestaurantSheet
          name={payload.name}
          stopLabel={payload.stopLabel}
          stopColor={payload.stopColor}
          onClose={handleClose}
        />
      )}
      {payload?.kind === 'hike' && (
        <HikeSheet
          name={payload.name}
          stopLabel={payload.stopLabel}
          stopColor={payload.stopColor}
          onClose={handleClose}
        />
      )}
      {payload?.kind === 'hotel' && (
        <HotelSheet
          booking={payload.booking}
          stopColor={payload.stopColor}
          onClose={handleClose}
        />
      )}
      {payload?.kind === 'flight' && (
        <FlightSheet
          booking={payload.booking}
          stopColor={payload.stopColor}
          onClose={handleClose}
        />
      )}
    </BottomSheetModal>
  );
});

const s = StyleSheet.create({
  handle:     { backgroundColor: Core.border, width: 36, height: 4 },
  background: { backgroundColor: Core.bg, borderRadius: 24 },
});
