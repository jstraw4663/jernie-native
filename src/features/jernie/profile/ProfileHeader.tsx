import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Core, Radius, Spacing, Typography } from '@/src/design/tokens';

interface ProfileHeaderProps {
  tripName: string;
  /** Active stop's colour — ties the badge to whichever stop the trip is currently on. */
  accentColor: string;
  /** Opens the trip switcher. The Key Decisions Log puts it in this header. */
  onSwitchTrip: () => void;
}

export function ProfileHeader({ tripName, accentColor, onSwitchTrip }: ProfileHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <Text style={styles.title}>Profile</Text>
      <Pressable
        testID="trip-switcher"
        onPress={onSwitchTrip}
        style={({ pressed }) => [
          styles.badge,
          { backgroundColor: `${accentColor}1F`, borderColor: `${accentColor}55` },
          pressed && styles.badgePressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Current trip: ${tripName}. Switch trip.`}
      >
        <Text style={[styles.badgeText, { color: accentColor }]} numberOfLines={1}>{tripName}</Text>
        <Text style={[styles.chevron, { color: accentColor }]} allowFontScaling={false}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  title: { ...Typography.roles.display, color: Core.text },
  badge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs + 2,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    maxWidth: '55%',
  },
  badgePressed: { opacity: 0.7 },
  badgeText: { ...Typography.roles.label, flexShrink: 1 },
  chevron: { fontSize: 18, fontFamily: Typography.family.sans },
});
