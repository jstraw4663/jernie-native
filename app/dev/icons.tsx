// Dev-only icon diagnostic. Reach it at jernie://dev/icons
//
// Icons render as a small salmon box with a single letter. That is React Native's Fabric
// placeholder for a native component the binary does not contain — the label reads
// "Unimplemented component: <Name>" and gets crushed to one character at icon size.
// This screen renders the same things at 200px so the label is legible and names the
// component outright, and probes the layers underneath it.
import { ScrollView, Text, View, StyleSheet, UIManager, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Svg, { Circle } from 'react-native-svg';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';

// ── Layer probes, all guarded: this screen must render even when everything is broken ──
function probe(label: string, fn: () => unknown): string {
  try {
    const v = fn();
    return `${label}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
  } catch (e) {
    return `${label}: THREW ${(e as Error)?.message ?? e}`;
  }
}

const LINES = [
  probe('renderer', () => ((global as Record<string, unknown>).nativeFabricUIManager ? 'Fabric (new arch)' : 'Paper (old arch)')),
  probe('native app version', () => Constants.nativeAppVersion),
  probe('native build number', () => Constants.nativeBuildVersion),
  probe('runtime', () => Constants.expoConfig?.runtimeVersion ?? '(none)'),
  probe('appOwnership', () => Constants.appOwnership ?? 'standalone/dev-client'),
  probe('react-native-svg JS export', () => typeof Svg),
  probe('UIManager has RNSVGSvgView', () => (UIManager as unknown as { hasViewManagerConfig?: (n: string) => boolean }).hasViewManagerConfig?.('RNSVGSvgView') ?? 'no hasViewManagerConfig'),
  probe('UIManager has RNSVGCircle', () => (UIManager as unknown as { hasViewManagerConfig?: (n: string) => boolean }).hasViewManagerConfig?.('RNSVGCircle') ?? 'n/a'),
  probe('platform', () => `${Platform.OS} ${String(Platform.Version)}`),
];

export default function IconCheck() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h}>1 — react-native-svg, raw</Text>
        <Text style={s.note}>
          A plain Svg + Circle, no Phosphor involved. A green disc means the native module is
          present and the problem is above it. A salmon box means it is not — read the name
          in the label.
        </Text>
        <View style={s.stage}>
          <Svg width={200} height={200} viewBox="0 0 100 100">
            <Circle cx={50} cy={50} r={45} fill="#0F7B6C" />
          </Svg>
        </View>

        <Text style={s.h}>2 — Phosphor, same size</Text>
        <Text style={s.note}>
          If 1 is a disc and this is a box, the fault is in phosphor-react-native, not svg.
        </Text>
        <View style={s.stage}>
          <HouseLineIcon size={200} color="#0F7B6C" weight="fill" />
        </View>

        <Text style={s.h}>3 — Layer probes</Text>
        <View style={s.probes}>
          {LINES.map(l => <Text key={l} style={s.mono}>{l}</Text>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { padding: 20, paddingBottom: 64 },
  h:      { fontSize: 20, fontFamily: 'DMSans-Bold', marginTop: 28, marginBottom: 4, color: '#111111' },
  note:   { fontSize: 13, lineHeight: 19, fontFamily: 'DMSans', color: '#666666', marginBottom: 12 },
  stage:  { minHeight: 210, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E4E4E4', borderRadius: 12 },
  probes: { gap: 6, paddingVertical: 8 },
  mono:   { fontSize: 11, lineHeight: 16, fontFamily: 'DMMono', color: '#333333' },
});
