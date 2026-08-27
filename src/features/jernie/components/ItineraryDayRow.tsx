import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { ItineraryDay, ItineraryItem, ItineraryItemCategory } from '@/src/types';
import { Core, Radius, Spacing, TypeColors, Typography } from '@/src/design/tokens';
import { hexWithAlpha } from '@/src/utils/colors';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Height uses withTiming (deterministic ease-out) — no overshoot possible on a dimension.
// Chevron uses withSpring so it has a snap of life without affecting layout.
const TIMING_EXPAND   = { duration: 260, easing: Easing.out(Easing.cubic) };
const TIMING_COLLAPSE = { duration: 200, easing: Easing.in(Easing.quad)  };
const SPRING_CHEVRON  = { stiffness: 400, damping: 44 };

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
  onItemPress?: (item: ItineraryItem) => void;
}

export function ItineraryDayRow({ day, dayNumber, stopColor, isExpanded, onPress, onItemPress }: ItineraryDayRowProps) {
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
    animatedHeight.value = withTiming(
      isExpanded ? naturalHeight.current : 0,
      isExpanded ? TIMING_EXPAND : TIMING_COLLAPSE,
    );
    chevronProgress.value = withSpring(isExpanded ? 1 : 0, SPRING_CHEVRON);
  }, [isExpanded]);

  const itemListStyle = useAnimatedStyle(() => ({
    // Math.max prevents negative height during spring undershoot, which would
    // cause a flicker (RN clamps negative height to 0 → looks open → springs back → closed).
    height: Math.max(0, animatedHeight.value),
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{
      rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg`,
    }],
  }));

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity testID={`itinerary-day-${day.id}`} onPress={onPress} style={styles.header} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, {
            backgroundColor: stopColor,
            shadowColor: stopColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 5,
            elevation: 0,
          }]} />
          <View>
            <Text style={styles.dayLabel}>Day {dayNumber}</Text>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.itemCount}>{day.items.length} item{day.items.length !== 1 ? 's' : ''}</Text>
          <Animated.View style={chevronStyle}>
            <CaretDownIcon size={13} color={Core.textFaint} style={styles.chevron} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Always rendered — height springs to 0 when collapsed */}
      <Animated.View style={[styles.animatedContainer, itemListStyle]}>
        <View style={styles.itemList} onLayout={handleContentLayout}>
          {sortedItems.map((item, i) => {
            const cat = item.category;
            const color = (cat ? CATEGORY_COLOR[cat] : undefined) ?? Core.textMuted;
            return (
              <React.Fragment key={item.id}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity
                  onPress={() => onItemPress?.(item)}
                  activeOpacity={onItemPress ? 0.7 : 1}
                  style={styles.itemRow}
                >
                  <Text style={[styles.itemTime, { color: stopColor }]}>{item.time ?? ''}</Text>
                  <Text style={styles.itemName} numberOfLines={2}>{item.label ?? ''}</Text>
                  {cat && (
                    <View style={[styles.catPill, { backgroundColor: color }]}>
                      <Text style={styles.catText}>{cat}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.tile,
    backgroundColor: Core.surface,
    borderWidth: 1,
    borderColor: Core.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dayLabel:  { ...Typography.roles.chip, color: Core.text },
  dateLabel: { ...Typography.roles.sub,  color: Core.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemCount:  { ...Typography.roles.sub, color: Core.textMuted },
  chevron:    { fontSize: 18, color: Core.textMuted, lineHeight: 22 },
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
  itemDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Core.border,
    marginHorizontal: Spacing.base,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: Spacing.base,
    gap: 10,
  },
  itemTime: {
    ...Typography.roles.data,
    width: 52,
    fontWeight: '600',
    fontSize: 13,
  },
  itemName: {
    ...Typography.roles.body,
    color: Core.text,
    flex: 1,
    fontWeight: '600',
    fontSize: 15,
  },
  catPill:  { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  catText:  { ...Typography.roles.caps, color: Core.white },
});
