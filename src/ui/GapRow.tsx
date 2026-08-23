// A hole in the plan, rendered as a row rather than an absence: a stop with no stay, or a
// stop the rental car does not reach. Always carries its own action.
//
// Derived, never hand-authored — the logic that decides which gaps exist is a pure function
// over stops and bookings and belongs in `src/domain/gaps.ts` (Session 5). Only stays and
// transport generate gaps; eating and doing are preferences and only ever count.
// Amber, never red.
// Reference: .claude/skills/jernie-design/components/travel/GapRow.{d.ts,jsx}
import { Pressable, Text, View } from 'react-native';
import { PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from './haptics';

export interface GapRowProps {
  /** "Nowhere to sleep in Southwest Harbor" */
  title: string;
  /** "May 27 – 29 · 2 nights unbooked" */
  sub: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}

export function GapRow({ title, sub, action = 'Add', onAction, testID }: GapRowProps) {
  const [s] = useStyles();
  const handlePress = onAction ? () => { tap(); onAction(); } : undefined;

  return (
    <View testID={testID} style={s.row} accessibilityLabel={`${title}. ${sub}`}>
      <View style={s.mark}><Text style={s.markTxt}>!</Text></View>

      <View style={s.body}>
        <Text style={s.title} numberOfLines={2}>{title}</Text>
        <Text style={s.sub} numberOfLines={1}>{sub}</Text>
      </View>

      <Pressable
        onPress={handlePress}
        disabled={!handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${action}. ${title}`}
        style={({ pressed }) => [s.pill, pressed && handlePress && s.pressed]}
      >
        <Text style={s.pillTxt} numberOfLines={1}>{action}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.rowPad,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    // Android renders a dashed border as a solid one above radius 15. `Radius.row` is
    // exactly 15, so this sits on the limit — do not raise it here or on PromptRow.
    borderStyle: 'dashed' as const,
    borderColor: t.warningLine,
    borderRadius: Radius.row,
    backgroundColor: t.warningSoft,
  },
  mark: {
    width: 28, height: 28,
    borderRadius: Radius.icon,
    backgroundColor: t.warningSoft,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  // A typographic bang, not a Phosphor Warning glyph — the reference sets it in DM Sans,
  // the same call the icon sweep made for arrows and rating stars.
  markTxt: { fontSize: 13, lineHeight: 13, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: t.warning },

  body:  { flex: 1, minWidth: 0 },
  title: { fontSize: 12.5, lineHeight: 16, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: t.warningInk },
  sub:   { ...Typography.roles.dataSm, color: t.warning, marginTop: 2 },

  pill:    { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: t.text, justifyContent: 'center', flexShrink: 0 },
  pillTxt: { fontSize: 11, lineHeight: 11, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: t.surface },
  pressed: { opacity: PRESSED_OPACITY },
}));
