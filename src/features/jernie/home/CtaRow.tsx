// One row, one suggestion. The single most useful next thing at this stop.
//
// The design has exactly one CTA on home — icon tile, title, subline, action pill, teal for
// an opportunity and amber for a gap. Which suggestion it carries is a priority decision,
// not a layout one:
//
//   1. the save nudge   — the account is at risk; nothing about the trip outranks that
//   2. setup            — pre-trip, things the traveller said they'd book and hasn't
//   3. a gap            — Session 5, once src/domain/gaps.ts can derive one
//   4. nothing          — the row does not render
//
// This replaces `CTACardZone`'s three-card phase router. The router's pre-trip checklist and
// in-trip quick-action grid are deliberately gone — a row cannot hold four setup rows, and
// the design does not ask it to. The save nudge is NOT gone: it is priority 1 here, keeping
// the four Apple sign-in outcomes and the twelve tests that cover them.
import type { Icon } from 'phosphor-react-native';
import { BedIcon } from 'phosphor-react-native/src/icons/Bed';
import { CloudArrowUpIcon } from 'phosphor-react-native/src/icons/CloudArrowUp';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Gutter, PRESSED_OPACITY, Radius, Spacing } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { iconFor } from '@/src/design/icons';
import { tap } from '@/src/ui';

export type CtaTone = 'accent' | 'warning';

export interface CtaRowProps {
  Glyph: Icon;
  title: string;
  sub: string;
  action: string;
  tone?: CtaTone;
  /** Spinner in place of the action label. */
  busy?: boolean;
  onPress: () => void;
  /** Renders the trailing dismiss cross when given. */
  onDismiss?: () => void;
  testID?: string;
  actionTestID?: string;
  dismissTestID?: string;
}

export function CtaRow({
  Glyph, title, sub, action, tone = 'accent', busy, onPress, onDismiss,
  testID, actionTestID, dismissTestID,
}: CtaRowProps) {
  const [s, t] = useStyles();
  const warn = tone === 'warning';
  const ink = warn ? t.warning : t.text;

  return (
    <View style={s.outer}>
      <View
        testID={testID}
        style={[s.row, { backgroundColor: warn ? t.warningSoft : t.actionSoft, borderColor: warn ? t.warningLine : t.actionLine }]}
      >
        <View style={[s.tile, { backgroundColor: warn ? t.warningSoft : t.surface }]}>
          <Glyph size={18} color={ink} weight="fill" />
        </View>

        <View style={s.body}>
          <Text style={[s.title, { color: ink }]} numberOfLines={2}>{title}</Text>
          <Text style={s.sub} numberOfLines={2}>{sub}</Text>
        </View>

        {onDismiss ? (
          <Pressable
            testID={dismissTestID}
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={({ pressed }) => [s.dismiss, pressed && s.pressed]}
          >
            <XIcon size={13} color={t.textFaint} weight="bold" />
          </Pressable>
        ) : null}

        <Pressable
          testID={actionTestID}
          onPress={() => { tap(); onPress(); }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`${action}. ${title}`}
          style={({ pressed }) => [s.pill, pressed && s.pressed]}
        >
          {busy
            ? <ActivityIndicator size="small" color={t.surface} />
            : <Text style={s.pillTxt} numberOfLines={1}>{action}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

/** The glyph a setup key should show. Keeps the row honest about what it is nudging. */
export const SETUP_GLYPH = {
  flights: iconFor('flight'),
  stays: iconFor('stay'),
  car: iconFor('car'),
  restaurants: iconFor('food'),
} as const;

export const NUDGE_GLYPH: Icon = CloudArrowUpIcon;
export const STAY_GLYPH: Icon = BedIcon;

const useStyles = createThemedStyles((t) => ({
  outer: { paddingHorizontal: Gutter, paddingTop: Spacing.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: 13,
    borderRadius: Radius.card - 2,
    borderWidth: 1,
  },
  tile: {
    width: 38, height: 38,
    borderRadius: Radius.tile,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, lineHeight: 16, fontFamily: 'DMSans-Bold', fontWeight: '700' as const },
  sub: {
    fontSize: 10.5, lineHeight: 14,
    fontFamily: 'DMSans', fontWeight: '400' as const,
    color: t.textMuted, marginTop: 2,
  },
  dismiss: { padding: 2, flexShrink: 0 },
  pill: {
    height: 30, paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: t.text,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    minWidth: 54,
  },
  pillTxt: { fontSize: 11.5, lineHeight: 11.5, fontFamily: 'DMSans-Bold', fontWeight: '700' as const, color: t.surface },
  pressed: { opacity: PRESSED_OPACITY },
}));
