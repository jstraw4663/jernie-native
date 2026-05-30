import { View, Text, StyleSheet } from 'react-native';
import { Core, Typography } from '@/src/design/tokens';

export default function ExploreTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore</Text>
      <Text style={styles.sub}>Carousels · List · Search — Plan 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { ...Typography.roles.display, color: Core.text, marginBottom: 8 },
  sub: { ...Typography.roles.meta, color: Core.textMuted, textAlign: 'center' },
});
