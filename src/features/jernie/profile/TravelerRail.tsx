import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Core, Semantic, Spacing, Typography } from '@/src/design/tokens';
import { Avatar } from '@/src/features/jernie/profile/Avatar';
import type { TripMember } from '@/src/types';

interface TravelerRailProps {
  members: TripMember[];
  currentUid: string | null;
  accentColor: string;
  onSelect: (member: TripMember) => void;
}

/**
 * Horizontal rail of everyone on the trip.
 *
 * No presence dot: the migration spec asks for one, but there is no `.info/connected`
 * presence subsystem in this app, and a dot that always reads "online" is worse than none.
 * Role is shown instead — it is the thing that is actually knowable and actually matters.
 */
export function TravelerRail({ members, currentUid, accentColor, onSelect }: TravelerRailProps) {
  if (members.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {members.length === 1 ? 'Just you so far' : `${members.length} travellers`}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {members.map(member => {
          const isYou = member.uid === currentUid;
          const color = member.role === 'organizer' ? Semantic.confirmed : accentColor;
          return (
            <Pressable
              key={member.uid}
              testID={`traveler-${member.uid}`}
              onPress={() => onSelect(member)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${member.handle}${isYou ? ', you' : ''}, ${member.role}`}
            >
              <Avatar name={member.handle} size={44} color={color} />
              <Text style={styles.handle} numberOfLines={1}>
                {isYou ? 'You' : member.handle}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  title: { ...Typography.roles.labelCaps, color: Core.textMuted, paddingHorizontal: Spacing.xs },
  rail: { gap: Spacing.base, paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xxs },
  item: { alignItems: 'center', gap: Spacing.xs, width: 60 },
  itemPressed: { opacity: 0.6 },
  handle: { ...Typography.roles.meta, color: Core.textMuted, fontSize: 11, textAlign: 'center' },
});
