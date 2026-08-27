import type { Icon } from 'phosphor-react-native';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Core, Radius, Semantic, Spacing, Typography } from '@/src/design/tokens';

interface SettingsRowProps {
  /** Phosphor glyph for the leading square. Import per-icon; see src/design/icons.ts.
   *  uses letters — so an emoji is the honest primitive rather than a placeholder for one. */
  Glyph: Icon;
  label: string;
  sublabel?: string;
  /** Right-hand content: a value, a badge, a control. Omit for a plain chevron row. */
  accessory?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function SettingsRow({
  Glyph, label, sublabel, accessory, onPress, destructive, disabled, testID,
}: SettingsRowProps) {
  const labelColor = destructive ? Semantic.error : Core.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed, disabled && styles.rowDisabled]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
    >
      <View style={[styles.iconSquare, destructive && styles.iconSquareDestructive]}>
        <Glyph size={15} color={destructive ? Semantic.error : Core.textMuted} weight="fill" />
      </View>

      <View style={styles.labels}>
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel} numberOfLines={2}>{sublabel}</Text> : null}
      </View>

      {accessory ?? (onPress ? <CaretRightIcon size={15} color={Core.textFaint} style={styles.chevron} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    minHeight: 56,
  },
  rowPressed: { backgroundColor: Core.surfaceMuted },
  rowDisabled: { opacity: 0.45 },
  iconSquare: {
    width: 32, height: 32,
    borderRadius: Radius.icon,
    backgroundColor: Core.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  iconSquareDestructive: { backgroundColor: Semantic.errorSoft },
  icon: { fontSize: 16 },
  labels: { flex: 1, gap: 1 },
  label: { ...Typography.roles.body, lineHeight: 20 },
  sublabel: { ...Typography.roles.sub, color: Core.textMuted },
  chevron: { fontSize: 22, color: Core.textFaint, fontFamily: Typography.family.sans },
});
