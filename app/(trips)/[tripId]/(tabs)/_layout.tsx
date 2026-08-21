import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Core, Brand } from '@/src/design/tokens';
import { AdminUnlockProvider, useAdminUnlock } from '@/src/contexts/AdminUnlockContext';

// Minimal icon placeholders — replaced with SVG icons in Plan 4/5/6
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <Text style={[styles.iconText, focused && styles.iconTextActive]}>
        {label[0]}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  // The provider has to sit ABOVE <Tabs> so the Profile screen and the tab bar's own press
  // listener share one unlock state — the taps land on the bar, which the screen doesn't own.
  return (
    <AdminUnlockProvider>
      <TabsNavigator />
    </AdminUnlockProvider>
  );
}

function TabsNavigator() {
  const { registerTabPress } = useAdminUnlock();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Brand.navy,
        tabBarInactiveTintColor: Core.textFaint,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="jernie"
        options={{
          title: 'Jernie',
          tabBarIcon: ({ focused }) => <TabIcon label="J" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => <TabIcon label="E" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ focused }) => <TabIcon label="A" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon label="P" focused={focused} />,
        }}
        listeners={{ tabPress: registerTabPress }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 88 : 68,
    backgroundColor: Core.surface,
    borderTopColor: Core.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'DMSans',
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  iconActive: { backgroundColor: Core.surfaceMuted },
  iconText: { fontSize: 14, fontFamily: 'DMSans', color: Core.textFaint },
  iconTextActive: { color: Brand.navy },
});
