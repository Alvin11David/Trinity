import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href?: Href;
};

const PRIVACY_ROWS: Row[] = [
  { icon: 'ban-outline', label: 'Blocked Accounts', href: '/(main)/(app)/settings/blocked' as Href },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: 'bold' }}>Settings & Privacy</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.05, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 }}>
          Privacy
        </Text>
        {PRIVACY_ROWS.map((row) => (
          <Pressable
            key={row.label}
            onPress={() => row.href && router.push(row.href)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border }}
          >
            <Ionicons name={row.icon} size={20} color={c.text} />
            <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
