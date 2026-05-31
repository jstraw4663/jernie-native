import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { ItineraryDay, ItineraryItemCategory } from '@/src/types';
import { Core, TypeColors, Typography, Radius, Spacing } from '@/src/design/tokens';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Open: lazy bouncy spring matching PWA feel. Close: overdamped so it never undershoots 0.
// An underdamped close spring oscillates below height=0, which React Native clamps to 0,
// creating a visible "flicker open" as the spring bounces back above 0.
const SPRING_OPEN  = { stiffness: 130, damping: 19 };
const SPRING_CLOSE = { stiffness: 200, damping: 30 };

const CATEGORY_COLOR: Partial<Record<ItineraryItemCategory, string>> = {
  flight:     TypeColors.flight,
  restaurant: TypeColors.food,
  activity:   TypeColors.activity,
  sight:      TypeColors.sight,
  hike:       TypeColors.hike,
  transport:  TypeColors.car,
};

interface ItineraryDayRowProps {
  day: ItineraryDay;
  dayNumber: number;
  stopColor: string;
  isExpanded: boolean;
  onPress: () => void;
}

export function ItineraryDayRow({ day, dayNumber, stopColor, isExpanded, onPress }: ItineraryDayRowProps) {
  const d = new Date(day.dateIso + 'T12:00:00');
  const dateLabel = `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const sortedItems = [...day.items].sort((a, b) => a.order - b.order);

  // Measure the actual rendered content height via onLayout.
  // Avoids the fragile ITEM_ROW_HEIGHT estimate (body lineHeight 26 + padding 12 = 38px, not 44).
  const naturalHeight = useRef(0);

  const animatedHeight = useSharedValue(0);   // snapped to real height after first layout
  const chevronProgress = useSharedValue(isExpanded ? 1 : 0);

  // prevExpanded comparison guards the effect from firing on mount.
  const prevExpanded = useRef(isExpanded);

  const handleContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h <= 0 || naturalHeight.current > 0) return;
      naturalHeight.current = h;
      // Snap to correct position on first measurement — no spring on mount.
      animatedHeight.value = isExpanded ? h : 0;
    },
    [isExpanded],
  );

  useEffect(() => {
    if (prevExpanded.current === isExpanded) return;
    prevExpanded.current = isExpanded;
    const spring = isExpanded ? SPRING_OPEN : SPRING_CLOSE;
    animatedHeight.value = withSpring(isExpanded ? naturalHeight.current : 0, spring);
    chevronProgress.value = withSpring(isExpanded ? 1 : 0, spring);
  }, [isExpanded]);

  const itemListStyle = useAnimatedStyle(() => ({
    // Math.max prevents negative height during spring undershoot, which would
    // cause a flicker (RN clamps negative height to 0 → looks open → springs back → closed).
    height: Math.max(0, animatedHeight.value),
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{
      rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 90], Extrapolation.CLAMP)}deg`,
    }],
  }));

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity onPress={onPress} style={styles.header} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <View style={[styles.dotHalo, { backgroundColor: hexWithAlpha(stopColor, 0.18) }]}>
            <View style={[styles.dot, { backgroundColor: stopColor }]} />
          </View>
          <View>
            <Text style={styles.dayLabel}>Day {dayNumber}</Text>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.itemCount}>{day.items.length} item{day.items.length !== 1 ? 's' : ''}</Text>
          {/* Chevron wrapped in Animated.View for rotation */}
          <Animated.View style={chevronStyle}>
            <Text style={styles.chevron}>›</Text>
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Always rendered — height springs to 0 when collapsed */}
      <Animated.View style={[styles.animatedContainer, itemListStyle]}>
        <View style={styles.itemList} onLayout={handleContentLayout}>
          {sortedItems.map(item => {
            const cat = item.category;
            const color = (cat ? CATEGORY_COLOR[cat] : undefined) ?? Core.textMuted;
            return (
              <View key={item.id} style={styles.itemRow}>
                <Text style={[styles.itemTime, { color: stopColor }]}>{item.time ?? ''}</Text>
                <Text style={styles.itemName} numberOfLines={2}>{item.label ?? ''}</Text>
                {cat && (
                  <View style={[styles.catPill, { backgroundColor: hexWithAlpha(color, 0.12) }]}>
                    <Text style={[styles.catText, { color }]}>{cat}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Core.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dotHalo: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dayLabel:  { ...Typography.roles.label, color: Core.text },
  dateLabel: { ...Typography.roles.meta,  color: Core.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemCount:  { ...Typography.roles.meta, color: Core.textMuted },
  chevron:    { fontSize: 20, color: Core.textMuted },
  // chevronOpen removed — rotation is now Reanimated-driven
  animatedContainer: { overflow: 'hidden' },
  // position:absolute takes itemList out of the flex flow so Yoga measures its natural
  // height independently of the parent's height:0. Without this, onLayout reports 0
  // because Yoga constrains flex children to fit inside a height:0 container.
  itemList: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.base,
    gap: 8,
  },
  itemTime: { ...Typography.roles.mono, width: 52 },
  itemName: { ...Typography.roles.body, color: Core.text, flex: 1 },
  catPill:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  catText:  { ...Typography.roles.labelCaps },
});
