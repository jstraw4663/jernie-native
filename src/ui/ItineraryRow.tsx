// One plan on a day: time on the left, media, title, status subline.
// The fixed 44px mono time column is why an itinerary reads as a timetable — it is the
// point of the row, not a detail of it.
// Reference: .claude/skills/jernie-design/components/travel/ItineraryRow.{d.ts,jsx}
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PRESSED_OPACITY, Radius, Spacing, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';

export interface ItineraryRowProps {
  /** "12:10" or "FRI 22". */
  time: string;
  duration?: string;
  title: string;
  sub?: string;
  /** Transport and unbooked slots get an icon. */
  icon?: ReactNode;
  /** Places get a photo. Wins over `icon` when both are given. */
  photo?: ReactNode;
  badge?: ReactNode;
  /** Highlights the time in accent — the next thing happening. */
  now?: boolean;
  warn?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function ItineraryRow({
  time, duration, title, sub, icon, photo, badge, now, warn, onPress, testID,
}: ItineraryRowProps) {
  const [s, t] = useStyles();

  // No haptic: like ListRow, this opens a sheet. See src/ui/haptics.ts.
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[time, title, sub].filter(Boolean).join('. ')}
      style={({ pressed }) => [s.row, pressed && onPress && s.pressed]}
    >
      <View style={s.timeCol}>
        <Text style={[s.time, { color: now ? t.action : t.textMuted }]} numberOfLines={1}>{time}</Text>
        {duration ? <Text style={s.duration} numberOfLines={1}>{duration}</Text> : null}
      </View>

      <View style={s.media}>{photo ?? icon}</View>

      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={[s.sub, { color: warn ? t.warning : t.textMuted }]} numberOfLines={2}>{sub}</Text> : null}
      </View>

      {badge}
    </Pressable>
  );
}

const useStyles = createThemedStyles((t) => ({
  row: {
    flexDirection: 'row',
    gap: Spacing.rowPad,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: t.borderSoft,
  },
  timeCol:  { width: 44, flexShrink: 0, paddingTop: 3 },
  time:     { ...Typography.roles.data },
  duration: { ...Typography.roles.dataSm, color: t.textFaint, marginTop: 4 },

  media: {
    width: 44, height: 44,
    borderRadius: Radius.tile,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: t.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body:  { flex: 1, minWidth: 0, paddingTop: 2 },
  title: { ...Typography.roles.row, color: t.text },
  sub:   { ...Typography.roles.sub, marginTop: 2 },

  pressed: { opacity: PRESSED_OPACITY },
}));
