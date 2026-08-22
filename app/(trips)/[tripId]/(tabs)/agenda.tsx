import { View, Text, StyleSheet } from 'react-native';
import { Core, Typography } from '@/src/design/tokens';

export default function AgendaTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agenda</Text>
      <Text style={styles.sub}>Flights · Stays · Rental · Restaurants · Activities — Plan 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Core.surface, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { ...Typography.roles.display, color: Core.text, marginBottom: 8 },
  sub: { ...Typography.roles.sub, color: Core.textMuted, textAlign: 'center' },
});
