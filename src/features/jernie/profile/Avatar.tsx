import { View, Text, StyleSheet } from 'react-native';
import { Core, Radius, Typography } from '@/src/design/tokens';
import { getInitials } from '@/src/domain/profile';

interface AvatarProps {
  /** Handle or display name. Initials are derived here so no caller has to. */
  name: string;
  size?: number;
  /** Ring/fill tint — the member's stop or role colour. Defaults to the app action colour. */
  color?: string;
}

/**
 * Initials circle. The single home of the empty-name fallback: getInitials returns '' for a
 * blank name deliberately, so that decision lives in one place rather than in each caller.
 */
export function Avatar({ name, size = 44, color = Core.action }: AvatarProps) {
  const initials = getInitials(name);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: Radius.full, backgroundColor: `${color}1F`, borderColor: color },
      ]}
    >
      <Text
        // Scaled off the circle rather than a fixed token size: the same component renders
        // at 52 in the You card and 44 in the rail, and a fixed size fits neither well.
        style={[styles.initials, { color, fontSize: Math.round(size * 0.38) }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {initials || '·'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  initials: { fontFamily: Typography.family.sans, fontWeight: '700' },
});
