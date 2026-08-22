// Dev-only font check. Reach it at jernie://dev/fonts (or /dev/fonts on web).
//
// Weight in React Native comes from the FAMILY NAME, not from `fontWeight`. iOS synthesises
// nothing, and RN cannot drive a variable font's `wght` axis. This screen exists to prove
// each registered face is a distinct file, and to show what happens when you ask for a
// weight the family cannot supply.
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '@/src/design/tokens';

const SPECIMEN = 'Southwest Harbor · 7 of 8';

const FACES: { family: string; expect: string }[] = [
  { family: 'Fraunces',        expect: '400' },
  { family: 'DMSans',          expect: '400' },
  { family: 'DMSans-SemiBold', expect: '600' },
  { family: 'DMSans-Bold',     expect: '700' },
  { family: 'DMMono',          expect: '400' },
  { family: 'DMMono-Medium',   expect: '500' },
];

// The trap: same family, four different fontWeight values. All four must render IDENTICALLY.
// If they differ, something is synthesising weight and the family-name rule is not holding.
const TRAP_WEIGHTS = ['400', '500', '600', '700'] as const;

const ROLES = Object.keys(Typography.roles) as (keyof typeof Typography.roles)[];

export default function FontCheck() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h}>Six registered faces</Text>
        <Text style={s.note}>
          Each line is a different file. All six must look distinct — two identical lines
          mean a face failed to load and fell back. Fraunces must be Regular, not Black.
        </Text>
        {FACES.map(f => (
          <View key={f.family} style={s.row}>
            <Text style={s.key}>{f.family}</Text>
            <Text style={s.exp}>{f.expect}</Text>
            <Text style={[s.spec, { fontFamily: f.family }]}>{SPECIMEN}</Text>
          </View>
        ))}

        <Text style={s.h}>fontWeight is inert</Text>
        <Text style={s.note}>
          Four lines, all fontFamily &quot;DMSans&quot;, asking for 400 / 500 / 600 / 700.
          They must all render identically — that is why weight lives in the family name.
        </Text>
        {TRAP_WEIGHTS.map(w => (
          <View key={w} style={s.row}>
            <Text style={s.key}>DMSans</Text>
            <Text style={s.exp}>asks {w}</Text>
            <Text style={[s.spec, { fontFamily: 'DMSans', fontWeight: w }]}>{SPECIMEN}</Text>
          </View>
        ))}

        <Text style={s.h}>Typography roles</Text>
        <Text style={s.note}>
          Straight from src/design/tokens.ts. Every bold and semibold role must actually
          look heavier than body. Nothing here should be italic — the design has none.
        </Text>
        {ROLES.map(r => (
          <View key={r} style={s.roleRow}>
            <Text style={s.key}>{r}</Text>
            <Text style={Typography.roles[r]}>{SPECIMEN}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// Deliberately hard-coded neutrals, not tokens: this screen must stay readable through the
// palette rewrite, and it should not be a consumer of colours that are about to change.
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { padding: 20, gap: 4, paddingBottom: 64 },
  h:      { fontSize: 20, fontFamily: 'DMSans-Bold', marginTop: 28, marginBottom: 4, color: '#111111' },
  note:   { fontSize: 13, lineHeight: 19, fontFamily: 'DMSans', color: '#666666', marginBottom: 12 },
  row:    { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E4E4' },
  roleRow:{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E4E4' },
  key:    { fontSize: 10, fontFamily: 'DMMono', color: '#999999' },
  exp:    { fontSize: 10, fontFamily: 'DMMono', color: '#C0C0C0', position: 'absolute', right: 0, top: 8 },
  spec:   { fontSize: 22, color: '#111111' },
});
