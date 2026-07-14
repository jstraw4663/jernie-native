import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Core, Spacing, Radius, Typography } from '@/src/design/tokens';

export interface PillItem {
  id: string;
  label: string;
  emoji?: string;
  color?: string; // per-item accent override (e.g. a stop's own color)
}

interface FilterPillRowProps {
  items: PillItem[];
  activeId: string;
  onSelect: (id: string) => void;
  defaultColor: string;
}

export function FilterPillRow({ items, activeId, onSelect, defaultColor }: FilterPillRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.scroll}
      contentContainerStyle={s.row}
    >
      {items.map(item => {
        const active = item.id === activeId;
        const color = item.color ?? defaultColor;
        return (
          <TouchableOpacity
            key={item.id}
            testID={`pill-${item.id}`}
            style={[
              s.pill,
              { borderColor: active ? color : Core.border, backgroundColor: active ? color : Core.surface },
            ]}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.7}
          >
            {item.emoji && <Text style={s.emoji}>{item.emoji}</Text>}
            <Text style={[s.label, { color: active ? Core.white : Core.textMuted }]} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Fixed height + flexGrow:0 as a second line of defense: a horizontal ScrollView's
  // row content container defaults to alignItems:'stretch', which would otherwise
  // stretch each pill to fill whatever cross-axis space ends up available (this is
  // what caused pills to balloon into tall ovals when the keyboard opened).
  scroll: { flexGrow: 0, height: 44 },
  row:   { paddingHorizontal: Spacing.base, gap: Spacing.sm, alignItems: 'center' },
  pill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 7, alignSelf: 'center' },
  emoji: { fontSize: 12 },
  label: { ...Typography.roles.label },
});
