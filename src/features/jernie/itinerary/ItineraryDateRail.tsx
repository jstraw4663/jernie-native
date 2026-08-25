import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import type { TimelineDay } from '@/src/domain/itineraryTimeline';
import { Animation, Gutter, PRESSED_OPACITY, Radius, Typography } from '@/src/design/tokens';
import { createThemedStyles } from '@/src/design/useTheme';
import { tap } from '@/src/ui';

const DATE_TARGET_WIDTH = 44;
const DATE_CHIP_WIDTH = 38;
const DATE_CHIP_HEIGHT = 43;
const TODAY_RESERVED_WIDTH = 76;
const DATE_SELECTION_SPRING = {
  ...Animation.springs.snappy,
  damping: Animation.springs.snappy.damping * 1.4,
};

interface AnimatedDateLabelProps {
  children: ReactNode;
  selected: boolean;
  restingColor: string;
  selectedColor: string;
  style: StyleProp<TextStyle>;
}

function AnimatedDateLabel({ children, selected, restingColor, selectedColor, style }: AnimatedDateLabelProps) {
  const progress = useDerivedValue(
    () => withSpring(selected ? 1 : 0, DATE_SELECTION_SPRING),
    [selected],
  );
  const animated = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [restingColor, selectedColor]),
  }));
  return <Animated.Text style={[style, animated]}>{children}</Animated.Text>;
}

interface ItineraryDateRailProps {
  days: TimelineDay[];
  selectedDateIso: string;
  stopColors: Record<string, string>;
  onSelect: (dateIso: string) => void;
  showToday?: boolean;
  onToday?: () => void;
}

/**
 * The compact date control from the completed itinerary design. The vertical timeline owns
 * selection; this reports taps and keeps the scroll-owned date centered.
 */
export function ItineraryDateRail({
  days, selectedDateIso, stopColors, onSelect, showToday = false, onToday,
}: ItineraryDateRailProps) {
  const [s, t] = useStyles();
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const scrollXRef = useRef(0);
  const selectedIndex = days.findIndex(day => day.dateIso === selectedDateIso);
  const reserved = showToday ? TODAY_RESERVED_WIDTH : 0;
  const viewportWidth = Math.max(0, width - Gutter * 2 - reserved);
  const daysWidth = days.length * DATE_TARGET_WIDTH;
  const centeredLead = Math.max(0, (viewportWidth - daysWidth) / 2);
  const selectionX = Gutter
    + centeredLead
    + Math.max(selectedIndex, 0) * DATE_TARGET_WIDTH
    + (DATE_TARGET_WIDTH - DATE_CHIP_WIDTH) / 2;
  // Agenda's moving-pill spring, with 40% more damping for this smaller target.
  const selection = useAnimatedStyle(() => ({
    transform: [{
      translateX: withSpring(selectionX, DATE_SELECTION_SPRING),
    }],
  }));

  // Selection is owned by the vertical timeline. Move the rail only when the selected chip
  // leaves its usable viewport; restarting a horizontal centering animation at every vertical
  // day boundary makes the pinned rail look like it twitches.
  useEffect(() => {
    const index = days.findIndex(day => day.dateIso === selectedDateIso);
    if (index < 0) return;
    const currentX = scrollXRef.current;

    if (daysWidth <= viewportWidth) {
      if (currentX <= 1) return;
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }

    const chipLeft = Gutter + index * DATE_TARGET_WIDTH;
    const chipRight = chipLeft + DATE_TARGET_WIDTH;
    const visibleLeft = currentX + Gutter;
    const visibleRight = currentX + width - Gutter - reserved;
    let targetX = currentX;

    if (chipLeft < visibleLeft) {
      targetX = chipLeft - Gutter;
    } else if (chipRight > visibleRight) {
      targetX = chipRight - (width - Gutter - reserved);
    }

    const maximumX = Math.max(0, Gutter + daysWidth + Gutter + reserved - width);
    targetX = Math.max(0, Math.min(targetX, maximumX));
    if (Math.abs(targetX - currentX) <= 1) return;
    scrollRef.current?.scrollTo({ x: targetX, animated: true });
  }, [days, daysWidth, reserved, selectedDateIso, viewportWidth, width]);


  return (
    <View style={s.shell} accessibilityRole="tablist">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.content, showToday && s.contentWithToday]}
        testID="itinerary-date-rail"
        onScroll={(event) => {
          scrollXRef.current = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
      >
        {selectedIndex >= 0 ? (
          <Animated.View pointerEvents="none" style={[s.selection, selection]} />
        ) : null}
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
                !selected && day.isToday && s.chipToday,
              ]}>
                <AnimatedDateLabel
                  selected={selected}
                  restingColor={t.textMuted}
                  selectedColor={t.surface}
                  style={s.weekday}
                >
                  {day.weekday}
                </AnimatedDateLabel>
                <AnimatedDateLabel
                  selected={selected}
                  restingColor={t.text}
                  selectedColor={t.surface}
                  style={s.day}
                >
                  {day.dayOfMonth}
                </AnimatedDateLabel>
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
      {showToday && onToday ? (
        <Pressable
          testID="itinerary-today"
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          onPress={() => { tap(); onToday(); }}
          style={({ pressed }) => [s.todayTarget, pressed && s.pressed]}
        >
          <View style={s.todayPill}><Text style={s.todayText}>Today</Text></View>
        </Pressable>
      ) : null}
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
  content: {
    flexGrow: 1,
    paddingHorizontal: Gutter,
    gap: 0,
    justifyContent: 'center',
    position: 'relative',
  },
  contentWithToday: { paddingRight: Gutter + TODAY_RESERVED_WIDTH },
  selection: {
    position: 'absolute',
    left: 0,
    top: (DATE_TARGET_WIDTH - DATE_CHIP_HEIGHT) / 2,
    width: DATE_CHIP_WIDTH,
    height: DATE_CHIP_HEIGHT,
    borderRadius: Radius.tile,
    borderWidth: 1,
    borderColor: t.action,
    backgroundColor: t.action,
  },
  target: {
    width: DATE_TARGET_WIDTH,
    minHeight: DATE_TARGET_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  chip: {
    width: DATE_CHIP_WIDTH,
    paddingTop: 6,
    paddingBottom: 5,
    borderRadius: Radius.tile,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
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
  todayTarget: {
    position: 'absolute',
    right: Gutter,
    top: 8,
    width: 68,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
  },
  todayPill: {
    height: 30,
    paddingHorizontal: 13,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: t.actionLine,
    backgroundColor: t.actionSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: { ...Typography.roles.caps, color: t.action },
  pressed: { opacity: PRESSED_OPACITY },
}));
