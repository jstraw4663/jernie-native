import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, PhotoStrip, ReviewRail, QuickActions, DistanceModule } from './SheetParts';
import { FloatingCTA } from './FloatingCTA';
import { MOCK_RESTAURANT } from './mockEntityData';
import { Brand, Core, Semantic, Typography, Spacing } from '@/src/design/tokens';

interface RestaurantSheetProps {
  name: string;
  stopLabel: string;
  stopColor: string;
  onClose: () => void;
}

export function RestaurantSheet({ name, stopLabel, stopColor, onClose }: RestaurantSheetProps) {
  const [added, setAdded] = useState(false);
  const m = MOCK_RESTAURANT;
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => { 'worklet'; scrollY.value = e.contentOffset.y; });
  const priceLabel = ['', '$', '$$', '$$$'][m.price] ?? '';

  return (
    <View style={s.root}>
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} onScroll={scrollHandler} scrollEventThrottle={16}>
        <SheetHero
          mode="place"
          photoUri={m.heroPhoto}
          emoji="🍽️"
          categoryLabel="🍽 Restaurant"
          stopLabel={stopLabel}
          stopColor={stopColor}
          onClose={onClose}
          scrollY={scrollY}
        />

        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.subtitle}>{stopLabel} · Latin-Caribbean cuisine</Text>
          </View>
          <View style={s.ratingCol}>
            <Text style={s.stars}>★ {m.rating}</Text>
            <Text style={s.ratingCount}>({m.ratingCount.toLocaleString()})</Text>
            <Text style={s.price}>{priceLabel}</Text>
          </View>
        </View>

        <QuickActions actions={['📞 Call', '🌐 Website', '📍 Navigate']} stopColor={stopColor} />

        <View style={s.hoursRow}>
          <Text style={s.openNow}>Open now</Text>
          <Text style={s.hoursText}> · closes {m.closesAt}</Text>
        </View>

        <InfoSection title="Info" rows={[
          { label: 'About',   value: m.curatorNote },
          { label: 'Curated', value: '⭐ Must-visit pick' },
        ]} />
        <InfoSection title="Notes" rows={[
          { label: 'Guide notes', value: m.guideNote },
          { label: 'Heads up',    value: `⚠ ${m.headsUp}`, variant: 'warning' },
        ]} />

        <Text style={s.photoLabel}>Photos</Text>
        <PhotoStrip photos={m.photos} />

        <Text style={s.photoLabel}>Reviews</Text>
        <ReviewRail reviews={m.reviews} stopColor={stopColor} />

        <InfoSection title="Contact & Location" rows={[
          { label: 'Phone',   value: m.phone,   variant: 'link' },
          { label: 'Address', value: m.address, variant: 'link' },
          { label: 'Website', value: 'Open website', variant: 'link' },
        ]} />
        <View style={s.distPad}>
          <DistanceModule label={m.distanceLabel} value={m.distanceValue} stopColor={stopColor} />
        </View>
        <View style={s.bottomPad} />
      </BottomSheetScrollView>

      <FloatingCTA
        stopLabel={stopLabel}
        stopColor={stopColor}
        isAdded={added}
        onAdd={() => setAdded(true)}
        onView={() => {}}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flexGrow: 1 },
  titleRow:   { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:  { flex: 1 },
  name:       { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:   { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  ratingCol:  { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:      { fontSize: 13, color: Brand.gold, fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount:{ fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  price:      { fontSize: 12, color: Core.textMuted, fontFamily: 'DMSans', fontWeight: '500' as const },
  hoursRow:   { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  openNow:    { fontSize: 13, fontFamily: 'DMSans', fontWeight: '700' as const, color: Semantic.success },
  hoursText:  { fontSize: 13, fontFamily: 'DMSans', color: Core.textMuted },
  photoLabel: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  distPad:    { paddingHorizontal: Spacing.base },
  bottomPad:  { height: 16 },
});
