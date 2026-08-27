import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Core, Spacing, Typography } from '@/src/design/tokens';
import { getBuildLabel } from '@/src/version';

interface VersionRowProps {
  onFeedback: () => void;
}

/**
 * Build provenance plus the way into the feedback sheet.
 *
 * Shown in every build, not just __DEV__ as before: the build label is what a tester reads
 * off this screen to say which code they were running, so hiding it in release builds hid it
 * from the only people who needed it.
 */
export function VersionRow({ onFeedback }: VersionRowProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.build} selectable numberOfLines={2}>{getBuildLabel()}</Text>
      <Pressable
        testID="open-feedback"
        onPress={onFeedback}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Send feedback"
      >
        <Text style={styles.action}>Send feedback</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.base },
  build: { ...Typography.roles.data, color: Core.textFaint, textAlign: 'center' },
  action: { ...Typography.roles.button, color: Core.action },
});
