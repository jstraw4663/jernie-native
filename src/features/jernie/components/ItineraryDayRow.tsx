import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

// Height of each item row (paddingVertical:6 × 2 + ~32px text line height)
const ITEM_ROW_HEIGHT = 44;
const ITEM_LIST_BOTTOM_PAD = Spacing.sm; // 8px

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

  // Calculated from item count — no off-screen measurement needed
  const contentHeight = useMemo(
    () => day.items.length * ITEM_ROW_HEIGHT + ITEM_LIST_BOTTOM_PAD,
    [day.items.length]
  );

  const animatedHeight = useSharedValue(isExpanded ? contentHeight : 0);
  const chevronProgress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    animatedHeight.value = withSpring(isExpanded ? contentHeight : 0, {
      stiffness: 380,
      damping: 35,
    });
    chevronProgress.value = withSpring(isExpanded ? 1 : 0, {
      stiffness: 380,
      damping: 35,
    });
  }, [isExpanded, contentHeight]);

  const itemListStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
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
        <View style={styles.itemList}>
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
  itemList: { paddingBottom: Spacing.sm },
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
