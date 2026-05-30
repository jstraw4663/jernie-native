import { View, Text, StyleSheet } from 'react-native';
import { Core, Typography } from '@/src/design/tokens';

export default function ProfileTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.sub}>Settings · Traveler rail · Admin — Plan 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { ...Typography.roles.display, color: Core.text, marginBottom: 8 },
  sub: { ...Typography.roles.meta, color: Core.textMuted, textAlign: 'center' },
});
