import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Core, Semantic, Typography, Spacing, Radius, Brand } from '@/src/design/tokens';

// ── InfoSection ───────────────────────────────────────────────────────────────

interface InfoRowDef { label: string; value: string; variant?: 'default' | 'link' | 'warning' }

export function InfoSection({ title, rows }: { title: string; rows: InfoRowDef[] }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {rows.map((row, i) => (
        <View key={i} style={[s.infoRow, i === rows.length - 1 && s.infoRowLast]}>
          <Text style={s.rowLabel}>{row.label}</Text>
          <Text style={[
            s.rowValue,
            row.variant === 'link'    && s.rowLink,
            row.variant === 'warning' && s.rowWarning,
          ]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── PhotoStrip ────────────────────────────────────────────────────────────────

export function PhotoStrip({ photos }: { photos: readonly string[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
      {photos.map((uri, i) => (
        <Image key={i} source={{ uri }} style={s.photoThumb} />
      ))}
    </ScrollView>
  );
}

// ── ReviewRail ────────────────────────────────────────────────────────────────

interface ReviewDef { author: string; rating: number; text: string; time: number }

const AVATAR_BG = [Core.action, Brand.navySoft, Semantic.error];

export function ReviewRail({ reviews, stopColor }: { reviews: readonly ReviewDef[]; stopColor: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.reviewRail}>
      {reviews.map((r, i) => (
        <View key={i} style={s.reviewCard}>
          <View style={s.reviewTop}>
            <View style={[s.reviewAvatar, { backgroundColor: AVATAR_BG[i % AVATAR_BG.length] }]}>
              <Text style={s.reviewAvatarText}>{r.author[0]}</Text>
            </View>
            <View>
              <Text style={s.reviewName}>{r.author}</Text>
              <Text style={s.reviewDate}>{timeAgo(r.time)}</Text>
            </View>
          </View>
          <Text style={s.reviewStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Text>
          <Text style={s.reviewText}>{r.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function timeAgo(ms: number): string {
  const d = Math.floor((Date.now() - ms) / 86_400_000);
  if (d < 7)   return `${d} day${d !== 1 ? 's' : ''} ago`;
  if (d < 30)  return `${Math.floor(d / 7)} week${Math.floor(d / 7) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) !== 1 ? 's' : ''} ago`;
}

// ── QuickActions ──────────────────────────────────────────────────────────────

export function QuickActions({ actions, stopColor }: { actions: readonly string[]; stopColor: string }) {
  return (
    <View style={s.quickActions}>
      {actions.map((label, i) => (
        <TouchableOpacity
          key={i}
          style={[s.qaBtn, { backgroundColor: stopColor + '18', borderColor: stopColor + '30' }]}
          activeOpacity={0.7}
        >
          <Text style={[s.qaBtnText, { color: stopColor }]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── DistanceModule ────────────────────────────────────────────────────────────

export function DistanceModule({ label, value, stopColor }: { label: string; value: string; stopColor: string }) {
  return (
    <View style={s.distMod}>
      <Text style={s.distLabel}>{label}</Text>
      <Text style={[s.distValue, { color: stopColor }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section:       { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  sectionTitle:  { fontSize: 11, fontFamily: 'DMSans', fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', color: Core.textFaint, marginBottom: Spacing.sm },
  infoRow:       { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  infoRowLast:   { borderBottomWidth: 0 },
  rowLabel:      { width: 90, fontSize: 12, fontFamily: 'DMSans', fontWeight: '600', color: Core.textMuted, paddingTop: 1 },
  rowValue:      { flex: 1, fontSize: 13, fontFamily: 'DMSans', color: Core.text, lineHeight: 18 },
  rowLink:       { color: Core.action },
  rowWarning:    { color: Semantic.warning, fontWeight: '600' as const },
  photoStrip:    { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.md },
  photoThumb:    { width: 148, height: 96, borderRadius: Radius.lg },
  reviewRail:    { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.md },
  reviewCard:    { width: 248, backgroundColor: Core.surface, borderWidth: 1, borderColor: Core.border, borderRadius: Radius.xl, padding: Spacing.md },
  reviewTop:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  reviewAvatar:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 14, fontWeight: '700' as const, color: Core.white, fontFamily: 'DMSans' },
  reviewName:    { fontSize: 12, fontWeight: '700' as const, fontFamily: 'DMSans', color: Core.text },
  reviewDate:    { fontSize: 10, color: Core.textFaint, fontFamily: 'DMSans', marginTop: 1 },
  reviewStars:   { fontSize: 11, color: '#C89A2B', marginBottom: 7 },
  reviewText:    { fontSize: 12, fontFamily: 'DMSans', color: Core.textMuted, lineHeight: 17 },
  quickActions:  { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Core.border },
  qaBtn:         { height: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qaBtnText:     { fontSize: 12, fontWeight: '700' as const, fontFamily: 'DMSans' },
  distMod:       { backgroundColor: Core.surfaceMuted, borderRadius: Radius.md, padding: 10, marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Core.border },
  distLabel:     { fontSize: 12, fontFamily: 'DMSans', color: Core.textMuted },
  distValue:     { fontSize: 13, fontWeight: '700' as const, fontFamily: 'DMSans' },
});
