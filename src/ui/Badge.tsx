// Status on a row: Booked, Next, Open, Ends, Suggested. Two words maximum, and never the
// row's *type* — the icon says that.
// Reference: .claude/skills/jernie-design/components/core/Badge.{d.ts,jsx}
import { Text, View } from 'react-native';
import { createThemedStyles } from '@/src/design/useTheme';

export type BadgeTone = 'accent' | 'warning' | 'neutral' | 'solid';

export interface BadgeProps {
  label: string;
  /** `accent` secured · `warning` unfinished · `neutral` past or informational ·
   *  `solid` is reserved for "Today" on a day header. */
  tone?: BadgeTone;
  testID?: string;
}

export function Badge({ label, tone = 'neutral', testID }: BadgeProps) {
  const [s, t] = useStyles();

  const skin = {
    accent:  { bg: t.actionSoft,  fg: t.action },
    warning: { bg: t.warningSoft, fg: t.warning },
    neutral: { bg: t.surfaceMuted, fg: t.textMuted },
    // Reference hard-codes #fff here; `textInverse` is #FFFFFF in light and stays legible
    // on the dark palette's mint accent. Same reasoning as Button's `accent` variant.
    solid:   { bg: t.action, fg: t.textInverse },
  }[tone];

  return (
    <View testID={testID} style={[s.badge, { backgroundColor: skin.bg }]}>
      <Text style={[s.label, { color: skin.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  badge: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: 10,      // half the height — a pill, not a token radius
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  // Smaller and tighter than the `caps` role: 9.5px at 0.05em, not 10px at 0.13em.
  label: {
    fontSize: 9.5,
    lineHeight: 9.5,
    fontFamily: 'DMSans-Bold',
    fontWeight: '700' as const,
    letterSpacing: 0.475,
    textTransform: 'uppercase' as const,
  },
}));
