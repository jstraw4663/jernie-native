// TEMPORARY — Session 2c debugging. Delete once icons render.
//
// Icons show as a small salmon box with a "U". Two candidate explanations that look
// identical at 16px: React Native's Fabric placeholder for a missing native component
// ("Unimplemented component: <Name>", white-on-red-30%, font shrunk to fit), or a real SVG
// drawing the wrong thing. This renders both a raw react-native-svg shape and a Phosphor
// icon at 190px, where the two are impossible to confuse.
import { View, Text, StyleSheet, UIManager, Platform } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { HouseLineIcon } from 'phosphor-react-native/src/icons/HouseLine';

function probe(label: string, fn: () => unknown): string {
  try { return `${label}: ${String(fn())}`; }
  catch (e) { return `${label}: THREW ${(e as Error)?.message ?? e}`; }
}

export function DevIconProbe() {
  if (!__DEV__) return null;
  const lines = [
    probe('renderer', () => ((global as Record<string, unknown>).nativeFabricUIManager ? 'Fabric' : 'Paper')),
    probe('Svg export type', () => typeof Svg),
    probe('Svg.name', () => (Svg as unknown as { displayName?: string; name?: string }).displayName
      ?? (Svg as unknown as { name?: string }).name ?? '(anonymous)'),
    probe('hasViewManagerConfig RNSVGSvgView', () =>
      (UIManager as unknown as { hasViewManagerConfig?: (n: string) => boolean }).hasViewManagerConfig?.('RNSVGSvgView') ?? 'n/a'),
    probe('platform', () => `${Platform.OS} ${String(Platform.Version)}`),
  ];

  return (
    <View style={s.wrap}>
      <Text style={s.h}>ICON PROBE — temporary</Text>
      <View style={s.row}>
        <View style={s.cell}>
          <Text style={s.cap}>1 · raw svg</Text>
          <Svg width={190} height={190} viewBox="0 0 100 100">
            <Rect x={5} y={5} width={90} height={90} rx={12} fill="#0F7B6C" />
            <Circle cx={50} cy={50} r={28} fill="#FFFFFF" />
          </Svg>
        </View>
        <View style={s.cell}>
          <Text style={s.cap}>2 · phosphor</Text>
          <HouseLineIcon size={190} color="#0F7B6C" weight="fill" />
        </View>
      </View>
      <Text style={s.note}>
        1 is a teal square with a white hole = react-native-svg works. A red box with legible
        text = it does not, and the text names the component.
      </Text>
      {lines.map(l => <Text key={l} style={s.mono}>{l}</Text>)}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { margin: 12, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#A3485F', backgroundColor: '#FFFFFF', gap: 6 },
  h:    { fontSize: 13, fontFamily: 'DMSans-Bold', color: '#A3485F' },
  row:  { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  cell: { alignItems: 'center', gap: 4 },
  cap:  { fontSize: 10, fontFamily: 'DMMono', color: '#717171' },
  note: { fontSize: 11, lineHeight: 16, fontFamily: 'DMSans', color: '#717171' },
  mono: { fontSize: 10, lineHeight: 14, fontFamily: 'DMMono', color: '#333333' },
});
