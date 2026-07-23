import { createDrawerNavigator } from '@react-navigation/drawer';
import { withLayoutContext } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ProfileDrawer } from '../../src/components/ProfileDrawer';
import { useTheme } from '../../src/context/ThemeContext';

const { Navigator } = createDrawerNavigator();
const Drawer = withLayoutContext(Navigator);

export default function MainLayout() {
  const { isDark } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <ProfileDrawer {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: {
            backgroundColor: isDark ? '#161b22' : '#ffffff',
          },
        }}
      >
        <Drawer.Screen name="(app)" />
      </Drawer>
    </GestureHandlerRootView>
  );
}
