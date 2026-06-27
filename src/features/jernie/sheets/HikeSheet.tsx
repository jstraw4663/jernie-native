import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, PhotoStrip, DistanceModule } from './SheetParts';
import { FloatingCTA } from './FloatingCTA';
import { MOCK_HIKE } from './mockEntityData';
import { Brand, Core, Typography, Spacing, Radius } from '@/src/design/tokens';

interface HikeSheetProps {
  name: string;
  stopLabel: string;
  stopColor: string;
  onClose: () => void;
}

export function HikeSheet({ name, stopLabel, stopColor, onClose }: HikeSheetProps) {
  const [added, setAdded] = useState(false);
  const m = MOCK_HIKE;
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  return (
    <View style={s.root}>
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} onScroll={handleScroll} scrollEventThrottle={16}>
        <SheetHero
          mode="place"
          photoUri={m.heroPhoto}
          emoji="🥾"
          categoryLabel="🥾 Hike"
          stopLabel={stopLabel}
          stopColor={stopColor}
          onClose={onClose}
          scrollY={scrollY}
        />

        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.subtitle}>{stopLabel} · Loop trail in Acadia</Text>
          </View>
          <View style={s.ratingCol}>
            <Text style={s.stars}>★ 4.8</Text>
            <Text style={s.ratingCount}>(2,340)</Text>
          </View>
        </View>

        <View style={s.statsGrid}>
          <StatCard value={`${m.distance}`} label="Miles"      color={stopColor} />
          <StatCard value={`${m.elevationGain}`} label="Ft gain"   color={stopColor} />
          <StatCard value={m.difficulty}    label="Difficulty" color={stopColor} />
        </View>

        <InfoSection title="Info" rows={[
          { label: 'About',      value: m.curatorNote },
          { label: 'Route type', value: m.routeType },
          { label: 'Dogs',       value: m.dogFriendly ? 'Allowed on leash' : 'Not allowed' },
          { label: 'Curated',    value: '⭐ Must-do in Acadia' },
        ]} />
        <InfoSection title="Notes" rows={[
          { label: 'Guide notes', value: m.guideNote },
          { label: 'Heads up',    value: `⚠ ${m.headsUp}`, variant: 'warning' },
        ]} />

        <Text style={s.photoLabel}>Photos</Text>
        <PhotoStrip photos={m.photos} />

        <InfoSection title="Contact & Location" rows={[
          { label: 'Address', value: m.address, variant: 'link' },
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

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
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
  statsGrid:  { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.md },
  statCard:   { flex: 1, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, borderRadius: Radius.lg, padding: 10, alignItems: 'center' },
  statValue:  { fontSize: 18, fontWeight: '800' as const, fontFamily: 'DMSans', letterSpacing: -0.5, marginBottom: 3 },
  statLabel:  { fontSize: 10, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  photoLabel: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  distPad:    { paddingHorizontal: Spacing.base },
  bottomPad:  { height: 16 },
});
