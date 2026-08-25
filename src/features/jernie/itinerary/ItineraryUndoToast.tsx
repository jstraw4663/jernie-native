import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { Layout, PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from '@/src/ui';

export const ITINERARY_UNDO_MS = 4000;

/**
 * The delayed-commit bar. Its dismissal *is* the database write, which is why it is not a
 * notification library — see `reference/custom-components.md`.
 *
 * Resting and busy are an inverse ink bar: "Removed Eventide" is a completed action, not a
 * failure, and red would be the wrong word for it. Only `failed` earns red — the one place
 * the Session 12 gate names.
 */
export function ItineraryUndoToast({
  title, busy = false, failed = false, bottomInset = 0, onUndo, onDismiss,
}: {
  title: string;
  busy?: boolean;
  failed?: boolean;
  bottomInset?: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [s, t] = useStyles();

  useEffect(() => {
    if (busy || failed) return undefined;
    const timer = setTimeout(onDismiss, ITINERARY_UNDO_MS);
    return () => clearTimeout(timer);
  }, [busy, failed, onDismiss, title]);

  return (
    <View
      testID="itinerary-undo-toast"
      accessibilityLiveRegion="polite"
      style={[s.toast, failed && s.toastFailed, { bottom: bottomInset + Spacing.md }]}
    >
      <TrashIcon size={16} color={t.surface} weight="fill" />
      <Text style={s.message} numberOfLines={1}>
        {failed ? `Couldn't remove ${title}` : busy ? `Removing ${title}…` : `Removed ${title}`}
      </Text>
      <Pressable
        testID="itinerary-undo-action"
        accessibilityRole="button"
        accessibilityLabel={failed ? `Retry removing ${title}` : `Undo removing ${title}`}
        disabled={busy}
        onPress={() => { tap(); onUndo(); }}
        style={({ pressed }) => [s.action, pressed && s.pressed]}
      >
        <Text style={s.actionLabel}>{busy ? 'Removing…' : failed ? 'Retry' : 'Undo'}</Text>
      </Pressable>
      {/*
        A failed commit skips the auto-dismiss timer, so without this the bar is permanent
        whenever the retry keeps failing. The row is already back on screen — only the bar
        is stuck — so dismissing is safe and abandons the delete.
      */}
      {failed ? (
        <Pressable
          testID="itinerary-undo-dismiss"
          accessibilityRole="button"
          accessibilityLabel={`Dismiss — keep ${title}`}
          onPress={() => { tap(); onDismiss(); }}
          style={({ pressed }) => [s.dismiss, pressed && s.pressed]}
        >
          <XIcon size={15} color={t.surface} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(t => ({
  toast: {
    position: 'absolute', left: Spacing.base, right: Spacing.base, zIndex: 80,
    minHeight: Layout.tapMin + 4, paddingLeft: 14, borderRadius: Radius.row,
    // Inverse ink: dark bar in the light palette, light bar in the dark one.
    backgroundColor: t.text, borderWidth: 1, borderColor: t.text,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.rowPad,
  },
  toastFailed: { backgroundColor: t.error, borderColor: t.errorSoft },
  message: { ...Typography.roles.sub, color: t.surface, flex: 1 },
  action: {
    minWidth: Layout.tapMin, minHeight: Layout.tapMin,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { ...Typography.roles.button, color: t.surface },
  dismiss: {
    width: Layout.tapMin, minHeight: Layout.tapMin,
    alignItems: 'center', justifyContent: 'center',
  },
  pressed: { opacity: PRESSED_OPACITY },
}));
