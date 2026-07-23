import { TouchableOpacity, Image, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import type { DrawerActionHelpers } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useThemeColors } from '../hooks/useThemeColors';

export function DrawerAvatarButton() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerActionHelpers<any>>();
  const user = useAuthStore((state) => state.user);
  const c = useThemeColors();

  const initial = user?.username ? user.username.charAt(0).toUpperCase() : '?';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Open profile menu"
      activeOpacity={0.8}
      onPress={() => navigation.openDrawer()}
      style={[styles.button, { top: insets.top + 8, backgroundColor: c.primary }]}
    >
      {user?.avatar ? (
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
      ) : (
        <Text style={[styles.initial, { color: c.bg }]}>{initial}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  initial: {
    fontSize: 16,
    fontWeight: '700',
  },
});
