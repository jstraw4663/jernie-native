import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SheetHero } from './SheetHero';
import { InfoSection, PhotoStrip, ReviewRail, QuickActions } from './SheetParts';
import { FloatingCTA } from './FloatingCTA';
import { MOCK_RESTAURANT } from './mockEntityData';
import { Brand, Core, Typography, Spacing } from '@/src/design/tokens';
import type { Place, PlaceEnrichment, PlaceCategory } from '@/src/types';

const CATEGORY_META: Record<PlaceCategory, { emoji: string; label: string }> = {
  restaurant: { emoji: '🍽️', label: 'Restaurant' },
  sight:      { emoji: '🏛️', label: 'Sight' },
  activity:   { emoji: '🎯', label: 'Activity' },
  hike:       { emoji: '🥾', label: 'Hike' },
  bar:        { emoji: '🍸', label: 'Bar' },
  flight:     { emoji: '✈️', label: 'Flight' },
  other:      { emoji: '📍', label: 'Place' },
};

interface PlaceSheetProps {
  name: string;
  stopLabel: string;
  stopColor: string;
  place?: Place;
  enrichment?: PlaceEnrichment;
  isAdded?: boolean;
  onAdd?: () => void;
  onClose: () => void;
}

export function PlaceSheet({ name, stopLabel, stopColor, place, enrichment, isAdded = false, onAdd, onClose }: PlaceSheetProps) {
  const scrollY = useSharedValue(0);
  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.value = e.nativeEvent.contentOffset.y; };

  // No real place resolved (a handful of free-text Agenda items have no linked place) —
  // preserve the original mock-based rendering exactly, unchanged.
  if (!place) {
    const m = MOCK_RESTAURANT;
    const priceLabel = ['', '$', '$$', '$$$'][m.price] ?? '';
    return (
      <View style={s.root}>
        <SheetHero mode="place" photoUri={m.heroPhoto} emoji="🍽️" categoryLabel="🍽 Restaurant" stopLabel={stopLabel} stopColor={stopColor} onClose={onClose} scrollY={scrollY} />
        <BottomSheetScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
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
          <InfoSection title="Info" rows={[{ label: 'About', value: m.curatorNote }, { label: 'Curated', value: '⭐ Must-visit pick' }]} />
          <InfoSection title="Notes" rows={[{ label: 'Guide notes', value: m.guideNote }, { label: 'Heads up', value: `⚠ ${m.headsUp}`, variant: 'warning' }]} />
          <Text style={s.photoLabel}>Photos</Text>
          <PhotoStrip photos={m.photos} />
          <Text style={s.photoLabel}>Reviews</Text>
          <ReviewRail reviews={m.reviews} stopColor={stopColor} />
          <InfoSection title="Contact & Location" rows={[{ label: 'Phone', value: m.phone, variant: 'link' }, { label: 'Address', value: m.address, variant: 'link' }, { label: 'Website', value: 'Open website', variant: 'link' }]} />
          <View style={s.bottomPad} />
        </BottomSheetScrollView>
        <FloatingCTA stopLabel={stopLabel} stopColor={stopColor} isAdded={isAdded} onAdd={onAdd ?? (() => {})} onView={() => {}} />
      </View>
    );
  }

  // Real place — render only sections backed by real data (curated Place fields first,
  // then Firestore enrichment). No fake filler for anything neither source has.
  const meta = CATEGORY_META[place.category] ?? CATEGORY_META.other;
  const photos = [place.photoUrl, ...(enrichment?.photos ?? [])].filter((p): p is string => !!p);
  const rating = place.rating ?? enrichment?.rating;

  const infoRows: { label: string; value: string; variant?: 'default' | 'link' | 'warning' }[] = [];
  if (place.curatorNote) infoRows.push({ label: 'About', value: place.curatorNote });
  if (place.must) infoRows.push({ label: 'Curated', value: '⭐ Must-visit pick' });
  if (enrichment?.hours && enrichment.hours.length > 0) infoRows.push({ label: 'Hours', value: enrichment.hours.join(' · ') });

  const contactRows: { label: string; value: string; variant?: 'default' | 'link' | 'warning' }[] = [];
  if (enrichment?.phone) contactRows.push({ label: 'Phone', value: enrichment.phone, variant: 'link' });
  const address = place.addr ?? enrichment?.address;
  if (address) contactRows.push({ label: 'Address', value: address, variant: 'link' });
  if (enrichment?.website) contactRows.push({ label: 'Website', value: 'Open website', variant: 'link' });

  const quickActions = [
    ...(enrichment?.phone ? ['📞 Call'] : []),
    ...(enrichment?.website ? ['🌐 Website'] : []),
  ];

  return (
    <View style={s.root}>
      <SheetHero
        mode="place"
        photoUri={photos[0]}
        emoji={place.emoji ?? meta.emoji}
        categoryLabel={`${meta.emoji} ${meta.label}`}
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
              {enrichment?.ratingCount != null && <Text style={s.ratingCount}>({enrichment.ratingCount.toLocaleString()})</Text>}
              {!!place.price && <Text style={s.price}>{place.price}</Text>}
            </View>
          )}
        </View>

        {quickActions.length > 0 && <QuickActions actions={quickActions} stopColor={stopColor} />}
        {infoRows.length > 0 && <InfoSection title="Info" rows={infoRows} />}
        {photos.length > 0 && (
          <>
            <Text style={s.photoLabel}>Photos</Text>
            <PhotoStrip photos={photos} />
          </>
        )}
        {enrichment?.reviews && enrichment.reviews.length > 0 && (
          <>
            <Text style={s.photoLabel}>Reviews</Text>
            <ReviewRail reviews={enrichment.reviews} stopColor={stopColor} />
          </>
        )}
        {contactRows.length > 0 && <InfoSection title="Contact & Location" rows={contactRows} />}
        <View style={s.bottomPad} />
      </BottomSheetScrollView>

      <FloatingCTA stopLabel={stopLabel} stopColor={stopColor} isAdded={isAdded} onAdd={onAdd ?? (() => {})} onView={() => {}} />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 80 },
  titleRow:   { padding: Spacing.base, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleLeft:  { flex: 1 },
  name:       { fontFamily: 'Fraunces', fontSize: 26, color: Core.text, marginBottom: 3, lineHeight: 30 },
  subtitle:   { ...Typography.roles.meta, color: Core.textMuted, lineHeight: 18 },
  ratingCol:  { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  stars:      { fontSize: 13, color: Brand.gold, fontWeight: '700' as const, fontFamily: 'DMSans' },
  ratingCount:{ fontSize: 11, color: Core.textFaint, fontFamily: 'DMSans' },
  price:      { fontSize: 12, color: Core.textMuted, fontFamily: 'DMSans', fontWeight: '500' as const },
  hoursRow:   { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  openNow:    { fontSize: 13, fontFamily: 'DMSans', fontWeight: '700' as const, color: '#3E7B52' },
  hoursText:  { fontSize: 13, fontFamily: 'DMSans', color: Core.textMuted },
  photoLabel: { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  bottomPad:  { height: 16 },
});
