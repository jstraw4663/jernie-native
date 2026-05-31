import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Brand, Core, Radius, Spacing, Typography } from '@/src/design/tokens';

interface Props {
  onRetry: () => void;
}

export function TripErrorScreen({ onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Couldn't load your trip</Text>
      <Text style={styles.body}>Check your connection and try again.</Text>
      <Pressable testID="retry-button" style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Core.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  heading: {
    ...Typography.roles.h2,
    color: Core.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.roles.body,
    color: Core.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  button: {
    backgroundColor: Brand.gold,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  buttonText: {
    ...Typography.roles.button,
    color: Core.white,
  },
});
