import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Brand, Core, Typography } from '@/src/design/tokens';

export function TripLoadingScreen() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.arc, arcStyle]} />
      <Text style={styles.label}>jernie</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Core.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: Brand.gold,
    borderTopColor: 'transparent',
  },
  label: {
    ...Typography.roles.h2Italic,
    color: Core.textMuted,
    marginTop: 16,
  },
});
