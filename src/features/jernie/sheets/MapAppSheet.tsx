import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetView, useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { useSheetContext } from '@/src/contexts/SheetContext';
import { Animation, Layout, PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { getAvailableMapsApps, openMapsApp, type MapsAppOption } from '@/src/lib/maps';
import { updatePreferredMapsApp } from '@/src/lib/userProfile';
import type { MapsAppId } from '@/src/types';
import { Button, tap } from '@/src/ui';

const DETECTION_ADDRESS = '1 Main Street';

export type MapAppSheetRef = {
  /** Address omitted means preference-only mode, used by Profile. */
  present: (input?: { address?: string }) => void;
  dismiss: () => void;
};

interface MapAppSheetProps {
  uid: string | null;
  preferredApp?: MapsAppId;
  onPreferenceChanged?: () => void;
}

export const MapAppSheet = React.forwardRef<MapAppSheetRef, MapAppSheetProps>(
  function MapAppSheet({ uid, preferredApp, onPreferenceChanged }, ref) {
    const modalRef = useRef<BottomSheetModal>(null);
    const requestRef = useRef(0);
    const wasOpen = useRef(false);
    const { increment, decrement } = useSheetContext();
    const [s, t] = useStyles();
    const [address, setAddress] = useState<string | undefined>();
    const [options, setOptions] = useState<MapsAppOption[]>([]);
    const [selected, setSelected] = useState<MapsAppId | null>(preferredApp ?? null);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const animationConfigs = useBottomSheetSpringConfigs(Animation.springs.drag);

    const load = useCallback(async (nextAddress?: string) => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      const preferenceOnly = !nextAddress;
      setAddress(nextAddress);
      setOptions([]);
      setSelected(preferredApp ?? null);
      setRemember(false);
      setError(null);
      setLoading(true);
      modalRef.current?.present();

      const available = await getAvailableMapsApps(nextAddress ?? DETECTION_ADDRESS);
      if (requestRef.current !== request) return;
      setOptions(available);
      setSelected(current => {
        if (current && available.some(option => option.id === current)) return current;
        return preferenceOnly ? null : available[0]?.id ?? null;
      });
      setLoading(false);
    }, [preferredApp]);

    useImperativeHandle(ref, () => ({
      present(input) { void load(input?.address?.trim() || undefined); },
      dismiss() { modalRef.current?.dismiss(); },
    }), [load]);

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

    const handlePrimary = useCallback(async () => {
      if (busy || (!selected && address)) return;
      setBusy(true);
      setError(null);
      try {
        if (!address || remember) {
          if (!uid) throw new Error('No signed-in profile');
          await updatePreferredMapsApp(uid, selected);
          onPreferenceChanged?.();
        }
        if (address && selected && !(await openMapsApp(selected, address))) {
          throw new Error('Map app unavailable');
        }
        modalRef.current?.dismiss();
      } catch {
        setError(address
          ? "Couldn't open that maps app. Choose another one."
          : "Couldn't save your maps preference. Try again.");
      } finally {
        setBusy(false);
      }
    }, [address, busy, onPreferenceChanged, remember, selected, uid]);

    const selectedLabel = options.find(option => option.id === selected)?.label;

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
          <View style={s.heading}>
            <View style={s.headingIcon}><MapPinIcon size={18} color={t.action} weight="fill" /></View>
            <View style={s.headingText}>
              <Text style={s.title}>{address ? 'Get directions' : 'Preferred maps app'}</Text>
              <Text style={s.subtitle} numberOfLines={2}>
                {address ?? 'Choose an installed app, or keep asking each time.'}
              </Text>
            </View>
          </View>

          <View style={s.options}>
            {!address ? (
              <MapOptionRow label="Ask every time" selected={selected === null} onPress={() => setSelected(null)} testID="maps-app-ask" />
            ) : null}
            {options.map(option => (
              <MapOptionRow
                key={option.id}
                label={option.label}
                selected={selected === option.id}
                onPress={() => setSelected(option.id)}
                testID={`maps-app-${option.id}`}
              />
            ))}
            {loading ? <Text style={s.loading}>Checking installed apps…</Text> : null}
          </View>

          {address && selected ? (
            <Pressable
              testID="maps-app-remember"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              accessibilityLabel={`Always use ${selectedLabel ?? 'this app'}`}
              onPress={() => { tap(); setRemember(value => !value); }}
              style={({ pressed }) => [s.remember, pressed && s.pressed]}
            >
              <View style={[s.checkbox, remember && s.checkboxSelected]}>
                {remember ? <CheckIcon size={13} color={t.textInverse} weight="bold" /> : null}
              </View>
              <Text style={s.rememberLabel}>Always use {selectedLabel ?? 'this app'}</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button
            testID="maps-app-primary"
            label={address ? `Open${selectedLabel ? ` in ${selectedLabel}` : ''}` : 'Save preference'}
            variant="accent"
            disabled={loading || busy || Boolean(address && !selected)}
            onPress={() => { void handlePrimary(); }}
          />
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

MapAppSheet.displayName = 'MapAppSheet';

function MapOptionRow({ label, selected, onPress, testID }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const [s, t] = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [s.option, selected && s.optionSelected, pressed && s.pressed]}
    >
      <Text style={s.optionLabel}>{label}</Text>
      <View style={[s.radio, selected && s.radioSelected]}>
        {selected ? <View style={[s.radioDot, { backgroundColor: t.action }]} /> : null}
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(t => ({
  handle: { backgroundColor: t.textFaint, width: 44, height: 5 },
  background: { backgroundColor: t.surface, borderRadius: Radius.sheet },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.base },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headingIcon: { width: 40, height: 40, borderRadius: Radius.tile, backgroundColor: t.actionSoft, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1, minWidth: 0, gap: Spacing.xs },
  title: { ...Typography.roles.title, color: t.text },
  subtitle: { ...Typography.roles.sub, color: t.textMuted },
  options: { borderWidth: 1, borderColor: t.border, borderRadius: Radius.row, overflow: 'hidden' },
  option: { minHeight: Layout.tapMin + 8, paddingHorizontal: Spacing.base, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface },
  optionSelected: { backgroundColor: t.actionSoft },
  optionLabel: { ...Typography.roles.body, color: t.text },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: t.textFaint, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: t.action },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  loading: { ...Typography.roles.sub, color: t.textMuted, padding: Spacing.base },
  remember: { minHeight: Layout.tapMin, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: t.textFaint, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: t.action, borderColor: t.action },
  rememberLabel: { ...Typography.roles.body, color: t.text },
  error: { ...Typography.roles.sub, color: t.error },
  pressed: { opacity: PRESSED_OPACITY },
}));
