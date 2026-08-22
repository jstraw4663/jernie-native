import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Core, Radius, Shadow, Spacing, Typography } from '@/src/design/tokens';

interface SettingsCardProps {
  title?: string;
  /** Rendered under the rows — error text, a hint, a form. */
  footer?: ReactNode;
  children: ReactNode;
}

/** Grouped-row container. Separators are drawn between children rather than on them, so a
 *  row does not have to know whether it is last. */
export function SettingsCard({ title, footer, children }: SettingsCardProps) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={[styles.card, Shadow.cardResting]}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.separator} /> : null}
            {row}
          </View>
        ))}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  title: { ...Typography.roles.labelCaps, color: Core.textMuted, paddingHorizontal: Spacing.xs },
  card: {
    backgroundColor: Core.surface,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Core.border,
    marginLeft: Spacing.base + 32 + Spacing.md,  // aligned to the label, past the icon square
  },
  footer: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, paddingTop: Spacing.xs },
});
