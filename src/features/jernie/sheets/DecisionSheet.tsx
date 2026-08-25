// One confirmation sheet for every "this needs your approval before it happens" moment.
//
// `@gorhom/bottom-sheet` owns the modal, the backdrop and the drag; the app-owned part is the
// template inside it — icon tile, title, message, and exactly two buttons. It replaced
// `MoveEntrySheet` and `RemoveEntrySheet`, which were the same 140 lines with different labels
// and a different tint. Registered in `reference/custom-components.md`.
//
// The footer composes `src/ui/Button`. `danger` is the destructive tone's variant, and is one
// of the only two places the system allows red — see the Colour rule in the design README.
import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetView, useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import type { Icon } from 'phosphor-react-native';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { Animation, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { Button } from '@/src/ui';

/**
 * Thrown from `onConfirm` when the failure has a better sentence than the request's fallback —
 * a stacked removal failing on the *previous* item, say. Anything else keeps `errorMessage`.
 */
export class DecisionSheetError extends Error {}

export interface DecisionRequest {
  Glyph: Icon;
  /** `destructive` tints the tile red and makes the confirm button `danger`. */
  tone: 'action' | 'destructive';
  /** Rendered verbatim — pass the whole question, including any "Remove …?". */
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  /** Shown on the confirm button while `onConfirm` is in flight. */
  busyLabel: string;
  /** Fallback sentence when `onConfirm` rejects with anything but a `DecisionSheetError`. */
  errorMessage: string;
  /** Namespaces this request's testIDs, e.g. `remove-entry` → `remove-entry-confirm`. */
  testIdPrefix: string;
  onConfirm: () => Promise<void>;
}

export interface DecisionSheetRef {
  present: (request: DecisionRequest) => void;
  dismiss: () => void;
}

export const DecisionSheet = React.forwardRef<DecisionSheetRef>(function DecisionSheet(_, ref) {
  const modalRef = useRef<BottomSheetModal>(null);
  const wasOpen = useRef(false);
  const { increment, decrement } = useSheetContext();
  const [s, t] = useStyles();
  const [request, setRequest] = useState<DecisionRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationConfigs = useBottomSheetSpringConfigs(Animation.springs.drag);

  useImperativeHandle(ref, () => ({
    present(nextRequest) {
      setRequest(nextRequest);
      setBusy(false);
      setError(null);
      modalRef.current?.present();
    },
    dismiss() { modalRef.current?.dismiss(); },
  }), []);

  const handleChange = useCallback((index: number) => {
    if (index >= 0 && !wasOpen.current) {
      wasOpen.current = true;
      increment();
    } else if (index === -1 && wasOpen.current) {
      wasOpen.current = false;
      decrement();
    }
  }, [decrement, increment]);

  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      opacity={0.45}
    />
  ), []);

  const handleConfirm = useCallback(async () => {
    if (!request || busy) return;
    setBusy(true);
    setError(null);
    try {
      await request.onConfirm();
      modalRef.current?.dismiss();
    } catch (cause) {
      // A `DecisionSheetError` names the real failure; anything else gets the generic sentence,
      // because an arbitrary throw's message is not written for a traveller to read.
      setError(cause instanceof DecisionSheetError ? cause.message : request.errorMessage);
    } finally {
      setBusy(false);
    }
  }, [busy, request]);

  const destructive = request?.tone === 'destructive';

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
        {request ? (
          <>
            <View style={s.heading}>
              <View style={[s.icon, destructive && s.iconDestructive]}>
                <request.Glyph size={19} color={destructive ? t.error : t.action} weight="fill" />
              </View>
              <View style={s.headingCopy}>
                <Text style={s.title}>{request.title}</Text>
                <Text style={s.message}>{request.message}</Text>
              </View>
            </View>

            {error ? (
              <Text testID={`${request.testIdPrefix}-error`} style={s.error}>{error}</Text>
            ) : null}

            <View style={s.actions}>
              <View style={s.slot}>
                <Button
                  testID={`${request.testIdPrefix}-cancel`}
                  label={request.cancelLabel}
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onPress={() => modalRef.current?.dismiss()}
                />
              </View>
              <View style={s.slot}>
                <Button
                  testID={`${request.testIdPrefix}-confirm`}
                  label={busy ? request.busyLabel : request.confirmLabel}
                  variant={destructive ? 'danger' : 'accent'}
                  size="md"
                  disabled={busy}
                  onPress={() => { void handleConfirm(); }}
                />
              </View>
            </View>
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

DecisionSheet.displayName = 'DecisionSheet';

const useStyles = createThemedStyles(t => ({
  handle: { backgroundColor: t.textFaint, width: 44, height: 5 },
  background: { backgroundColor: t.surface, borderRadius: Radius.sheet },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.base,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.rowPad },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.tile,
    backgroundColor: t.actionSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDestructive: { backgroundColor: t.errorSoft },
  headingCopy: { flex: 1, minWidth: 0, gap: Spacing.xs },
  title: { ...Typography.roles.title, color: t.text },
  message: { ...Typography.roles.sub, color: t.textMuted },
  error: { ...Typography.roles.sub, color: t.error },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  slot: { flex: 1 },
}));
