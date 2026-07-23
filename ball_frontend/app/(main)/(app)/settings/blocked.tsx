import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useBlockedAccounts, useUnblockAccount } from '../../../../src/hooks/useProfile';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';
import type { PostAuthor } from '../../../../src/api/feed';

function BlockedRow({ user, onUnblock, pending }: { user: PostAuthor; onUnblock: () => void; pending: boolean }) {
  const router = useRouter();
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Pressable
        onPress={() => router.push(`/(main)/(app)/profile/${user.username}` as Href)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
      >
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.muted, fontWeight: '600' }}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
            {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>@{user.username}</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onUnblock}
        disabled={pending}
        style={{ borderRadius: 9999, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 6 }}
      >
        {pending ? (
          <ActivityIndicator size="small" color={c.text} />
        ) : (
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 12 }}>Unblock</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function BlockedAccountsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useBlockedAccounts();
  const unblock = useUnblockAccount();
  const c = useThemeColors();

  const confirmUnblock = (user: PostAuthor) => {
    Alert.alert(
      `Unblock @${user.username}?`,
      'They will be able to see your posts and message you again. This does not restore any previous follow.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => unblock.mutate(user.username) },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: 'bold' }}>Blocked Accounts</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(u) => String(u.id)}
          renderItem={({ item }) => (
            <BlockedRow
              user={item}
              onUnblock={() => confirmUnblock(item)}
              pending={unblock.isPending && unblock.variables === item.username}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 96, paddingHorizontal: 32 }}>
              <Ionicons name="shield-checkmark-outline" size={32} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                You haven't blocked anyone.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
