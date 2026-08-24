import { Pressable, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { TimelineDay } from '@/src/domain/itineraryTimeline';
import { Gutter, PRESSED_OPACITY, Radius, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from '@/src/ui';

interface ItineraryDateRailProps {
  days: TimelineDay[];
  selectedDateIso: string;
  stopColors: Record<string, string>;
  onSelect: (dateIso: string) => void;
}

/**
 * The compact date control from the completed itinerary design. The vertical timeline owns
 * selection; this only reports taps. Integration will keep it centered from the shared
 * scroll position after Session 6 lands.
 */
export function ItineraryDateRail({
  days, selectedDateIso, stopColors, onSelect,
}: ItineraryDateRailProps) {
  const [s, t] = useStyles();

  return (
    <View style={s.shell} accessibilityRole="tablist">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.content}
        testID="itinerary-date-rail"
      >
        {days.map(day => {
          const selected = day.dateIso === selectedDateIso;
          return (
            <Pressable
              key={day.dateIso}
              testID={`itinerary-date-${day.dateIso}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={[
                `${day.weekday}, day ${day.dayOfMonth}`,
                day.segments.map(segment => segment.city).join(' to ') || 'Travel',
                day.warning ? 'Needs attention' : undefined,
                day.count === 1 ? '1 plan' : `${day.count} plans`,
              ].filter(Boolean).join('. ')}
              onPress={() => { tap(); onSelect(day.dateIso); }}
              style={({ pressed }) => [s.target, pressed && s.pressed]}
            >
              <View style={[
                s.chip,
                selected && s.chipSelected,
                !selected && day.isToday && s.chipToday,
              ]}>
                <Text style={[s.weekday, selected && s.textSelected]}>{day.weekday}</Text>
                <Text style={[s.day, selected && s.textSelected]}>{day.dayOfMonth}</Text>
                <View style={s.stopMarks}>
                  {day.segments.length === 0 ? (
                    <View style={[s.stopMark, s.travelMark, selected && { backgroundColor: t.surface }]} />
                  ) : day.segments.map(segment => (
                    <View
                      key={segment.stopId}
                      style={[
                        s.stopMark,
                        day.segments.length > 1 && s.stopMarkSplit,
                        { backgroundColor: selected ? t.surface : (stopColors[segment.stopId] ?? t.textFaint) },
                      ]}
                    />
                  ))}
                </View>
                {day.warning ? <View style={[s.warning, { borderColor: t.surface }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  shell: {
    backgroundColor: t.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    paddingVertical: 8,
  },
  content: { paddingHorizontal: Gutter, gap: 0 },
  target: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    width: 38,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: Radius.tile,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  chipSelected: { backgroundColor: t.action, borderColor: t.action },
  chipToday: { borderColor: t.actionLine },
  weekday: {
    ...Typography.roles.caps,
    fontSize: 7.5,
    lineHeight: 8,
    letterSpacing: 0.75,
    color: t.textMuted,
  },
  day: {
    fontFamily: 'DMSans-Bold',
    fontWeight: '700' as const,
    fontSize: 15,
    lineHeight: 15,
    letterSpacing: -0.5,
    color: t.text,
  },
  textSelected: { color: t.surface },
  stopMarks: { width: 12, height: 3, flexDirection: 'row', gap: 1 },
  stopMark: { flex: 1, height: 3, borderRadius: 2 },
  stopMarkSplit: { minWidth: 5 },
  travelMark: { backgroundColor: t.textFaint },
  warning: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: 1,
    backgroundColor: t.warning,
  },
  pressed: { opacity: PRESSED_OPACITY },
}));
