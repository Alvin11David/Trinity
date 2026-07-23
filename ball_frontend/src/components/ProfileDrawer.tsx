import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
};

const MENU_ITEMS: MenuItem[] = [
  { icon: 'person-outline', label: 'Profile', route: 'profile' },
  { icon: 'settings-outline', label: 'Settings & Privacy', route: 'settings' },
];

export function ProfileDrawer(_props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { isDark, toggleTheme } = useTheme();

  const username = user?.username ?? '';
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const followers = user?.followers_count ?? 0;
  const following = user?.following_count ?? 0;

  const bg = isDark ? '#161b22' : '#ffffff';
  const border = isDark ? '#30363d' : '#e2e8f0';
  const text = isDark ? '#e6edf3' : '#0f172a';
  const muted = isDark ? '#8b949e' : '#64748b';
  const green = isDark ? '#22c55e' : '#16a34a';
  const greenLight = isDark ? '#052e16' : '#f0fdf4';

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 16 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>B</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: text }}>Ball</Text>
        </View>

        {/* Avatar */}
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={{ width: 56, height: 56, borderRadius: 28 }} />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{initial}</Text>
          </View>
        )}

        {/* Names */}
        <Text style={{ color: text, fontSize: 18, fontWeight: '700', marginTop: 12 }}>{username}</Text>
        <Text style={{ color: muted, fontSize: 14, marginTop: 2 }}>@{username}</Text>

        {/* Followers / Following */}
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>{following}</Text>
            <Text style={{ color: muted, fontSize: 14 }}>Following</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: text, fontSize: 14, fontWeight: '700' }}>{followers}</Text>
            <Text style={{ color: muted, fontSize: 14 }}>Followers</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: border, marginVertical: 16 }} />

        {/* Nav Items */}
        <View style={{ gap: 2 }}>
          {MENU_ITEMS.map((item) => {
            let onPress: (() => void) | undefined;
            if (item.route === 'profile' && username) {
              onPress = () => router.push(`/(main)/(app)/profile/${username}` as never);
            } else if (item.route === 'settings') {
              onPress = () => router.push('/(main)/(app)/settings' as never);
            }
            return (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.7}
                onPress={onPress}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Ionicons name={item.icon} size={20} color={muted} />
                <Text style={{ color: text, fontSize: 14, fontWeight: '500' }}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Theme Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={toggleTheme}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={muted} />
            <Text style={{ color: text, fontSize: 14, fontWeight: '500' }}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: border, marginVertical: 16 }} />

        {/* Sign Out */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '500' }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
