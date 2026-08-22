import React from 'react';
import { PersonSimpleHikeIcon } from 'phosphor-react-native/src/icons/PersonSimpleHike';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, PhotoStrip } from './SheetParts';
import { FloatingCTA } from './FloatingCTA';
import { MOCK_HIKE } from './mockEntityData';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';
import type { Place, PlaceEnrichment } from '@/src/types';

interface HikeSheetProps {
  name: string;
  stopLabel: string;
  stopColor: string;
  place?: Place;
  enrichment?: PlaceEnrichment;
  isAdded?: boolean;
  onAdd?: () => void;
  onClose: () => void;
}

export function HikeSheet({ name, stopLabel, stopColor, place, enrichment, isAdded = false, onAdd, onClose }: HikeSheetProps) {
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  // No real place resolved — preserve the original mock-based rendering exactly, unchanged.
  if (!place) {
    const m = MOCK_HIKE;
    return (
      <View style={s.root}>
        <SheetHero mode="place" photoUri={m.heroPhoto} Glyph={PersonSimpleHikeIcon} categoryLabel="Hike" stopLabel={stopLabel} stopColor={stopColor} onClose={onClose} scrollY={scrollY} />
        <BottomSheetScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
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
            <StatCard value={`${m.distance}`} label="Miles" color={stopColor} />
            <StatCard value={`${m.elevationGain}`} label="Ft gain" color={stopColor} />
            <StatCard value={m.difficulty} label="Difficulty" color={stopColor} />
          </View>
          <InfoSection title="Info" rows={[
            { label: 'About', value: m.curatorNote },
            { label: 'Route type', value: m.routeType },
            { label: 'Dogs', value: m.dogFriendly ? 'Allowed on leash' : 'Not allowed' },
            { label: 'Curated', value: 'Must-do in Acadia' },
          ]} />
          <InfoSection title="Notes" rows={[
            { label: 'Guide notes', value: m.guideNote },
            { label: 'Heads up', value: m.headsUp, variant: 'warning' },
          ]} />
          <Text style={s.photoLabel}>Photos</Text>
          <PhotoStrip photos={m.photos} />
          <InfoSection title="Contact & Location" rows={[{ label: 'Address', value: m.address, variant: 'link' }]} />
          <View style={s.bottomPad} />
        </BottomSheetScrollView>
        <FloatingCTA stopLabel={stopLabel} stopColor={stopColor} isAdded={isAdded} onAdd={onAdd ?? (() => {})} onView={() => {}} />
      </View>
    );
  }

  // Real place — only sections backed by real data. No elevationGain/routeType/dogFriendly
  // equivalent exists in the imported data, so those stat cards/rows are simply omitted.
  const photos = [place.photoUrl, ...(enrichment?.photos ?? [])].filter((p): p is string => !!p);
  const rating = place.rating ?? enrichment?.rating;

  const stats: { value: string; label: string }[] = [];
  if (place.distance) stats.push({ value: place.distance, label: 'Distance' });
  if (place.difficulty) stats.push({ value: place.difficulty, label: 'Difficulty' });
  if (place.duration) stats.push({ value: place.duration, label: 'Duration' });

  const infoRows: { label: string; value: string; variant?: 'default' | 'link' | 'warning' }[] = [];
  if (place.curatorNote) infoRows.push({ label: 'About', value: place.curatorNote });
  if (place.must) infoRows.push({ label: 'Curated', value: 'Must-do pick' });

  const address = place.addr ?? enrichment?.address;

  return (
    <View style={s.root}>
      <SheetHero
        mode="place"
        photoUri={photos[0]}
        Glyph={PersonSimpleHikeIcon}
        categoryLabel="Hike"
        stopLabel={stopLabel}
        stopColor={stopColor}
        onClose={onClose}
        scrollY={scrollY}
      />
      <BottomSheetScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
        <View style={s.titleRow}>
          <View style={s.titleLeft}>
            <Text style={s.name}>{place.name}</Text>
            <Text style={s.subtitle}>{stopLabel}{place.subcategory ? ` · ${place.subcategory}` : ''}</Text>
          </View>
          {rating != null && (
            <View style={s.ratingCol}>
              <Text style={s.stars}>★ {rating}</Text>
            </View>
          )}
        </View>

        {stats.length > 0 && (
          <View style={s.statsGrid}>
            {stats.map(stat => <StatCard key={stat.label} value={stat.value} label={stat.label} color={stopColor} />)}
          </View>
        )}

        {infoRows.length > 0 && <InfoSection title="Info" rows={infoRows} />}

        {photos.length > 0 && (
          <>
            <Text style={s.photoLabel}>Photos</Text>
            <PhotoStrip photos={photos} />
          </>
        )}

        {address && <InfoSection title="Contact & Location" rows={[{ label: 'Address', value: address, variant: 'link' }]} />}
        <View style={s.bottomPad} />
      </BottomSheetScrollView>

      <FloatingCTA stopLabel={stopLabel} stopColor={stopColor} isAdded={isAdded} onAdd={onAdd ?? (() => {})} onView={() => {}} />
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
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 80 },
  titleRow:   { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:  { flex: 1 },
  name:       { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:   { ...Typography.roles.sub, color: Core.textMuted, lineHeight: 18 },
  ratingCol:  { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:      { fontSize: 13, color: Core.textMuted, fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount:{ fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  statsGrid:  { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.sm, marginBottom: Spacing.md },
  statCard:   { flex: 1, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, borderRadius: Radius.tile, padding: 10, alignItems: 'center' },
  statValue:  { fontSize: 18, fontWeight: '800' as const, fontFamily: 'DMSans', letterSpacing: -0.5, marginBottom: 3 },
  statLabel:  { fontSize: 10, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  photoLabel: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  bottomPad:  { height: 16 },
});
