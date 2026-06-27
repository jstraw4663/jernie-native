import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Core, Semantic, Spacing, Radius } from '@/src/design/tokens';

interface FloatingCTAProps {
  stopLabel: string;
  stopColor: string;
  isAdded: boolean;
  onAdd: () => void;
  onView: () => void;
}

export function FloatingCTA({ stopLabel, stopColor, isAdded, onAdd, onView }: FloatingCTAProps) {
  return (
    <View style={s.container}>
      {!isAdded ? (
        <TouchableOpacity style={[s.addBtn, { backgroundColor: stopColor }]} onPress={onAdd} activeOpacity={0.85}>
          <Text style={s.addPlus}>+</Text>
          <Text style={s.addTxt}>Add to {stopLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.addedPill}>
          <View style={[s.addedCheck, { backgroundColor: Semantic.confirmed }]}>
            <Text style={s.addedCheckTxt}>✓</Text>
          </View>
          <View style={s.addedBody}>
            <Text style={s.addedTitle}>In your itinerary</Text>
            <Text style={s.addedStop}>{stopLabel}</Text>
          </View>
          <TouchableOpacity style={s.viewBtn} onPress={onView} activeOpacity={0.75}>
            <Text style={s.viewBtnTxt}>View</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:     { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, backgroundColor: Core.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Core.border },
  addBtn:        { borderRadius: Radius.lg, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  addPlus:       { fontSize: 20, color: Core.white, lineHeight: 24, fontFamily: 'DMSans' },
  addTxt:        { fontSize: 15, fontWeight: '600' as const, color: Core.white, fontFamily: 'DMSans' },
  addedPill:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Semantic.confirmedTint, borderWidth: 0.5, borderColor: 'rgba(200,154,43,0.4)', borderRadius: Radius.lg, padding: Spacing.sm },
  addedCheck:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addedCheckTxt: { fontSize: 16, color: Core.white },
  addedBody:     { flex: 1 },
  addedTitle:    { fontSize: 13, fontWeight: '700' as const, color: Semantic.confirmedDark, fontFamily: 'DMSans' },
  addedStop:     { fontSize: 12, color: Semantic.confirmedDark, fontFamily: 'DMSans', opacity: 0.8 },
  viewBtn:       { paddingVertical: 7, paddingHorizontal: 13, borderRadius: Radius.full, borderWidth: 0.5, borderColor: 'rgba(200,154,43,0.55)' },
  viewBtnTxt:    { fontSize: 11, fontWeight: '600' as const, color: Semantic.confirmedDark, fontFamily: 'DMSans' },
});
