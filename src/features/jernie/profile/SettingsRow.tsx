import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Core, Semantic, Radius, Spacing, Typography } from '@/src/design/tokens';

interface SettingsRowProps {
  /** Emoji glyph for the leading square. This app has no icon set yet — the tab bar still
   *  uses letters — so an emoji is the honest primitive rather than a placeholder for one. */
  icon: string;
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
  icon, label, sublabel, accessory, onPress, destructive, disabled, testID,
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
        <Text style={styles.icon} allowFontScaling={false}>{icon}</Text>
      </View>

      <View style={styles.labels}>
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel} numberOfLines={2}>{sublabel}</Text> : null}
      </View>

      {accessory ?? (onPress ? <Text style={styles.chevron} allowFontScaling={false}>›</Text> : null)}
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
    borderRadius: Radius.md,
    backgroundColor: Core.surfaceMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  iconSquareDestructive: { backgroundColor: Semantic.errorTint },
  icon: { fontSize: 16 },
  labels: { flex: 1, gap: 1 },
  label: { ...Typography.roles.body, lineHeight: 20 },
  sublabel: { ...Typography.roles.meta, color: Core.textMuted },
  chevron: { fontSize: 22, color: Core.textFaint, fontFamily: Typography.family.sans },
});
