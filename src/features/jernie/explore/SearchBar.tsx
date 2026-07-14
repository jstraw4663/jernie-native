import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { Core, Spacing, Radius, Typography } from '@/src/design/tokens';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function SearchBar({ value, onChangeText }: SearchBarProps) {
  return (
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChangeText}
      placeholder="🔍 Search places…"
      placeholderTextColor={Core.textFaint}
      returnKeyType="search"
      autoCorrect={false}
    />
  );
}

const s = StyleSheet.create({
  input: {
    ...Typography.roles.body,
    color: Core.text,
    backgroundColor: Core.surfaceMuted,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
});
