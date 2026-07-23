import { View, Text, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePublicChannels, useJoinChannel } from '../../../../src/hooks/useChat';
import { extractApiError, type Conversation } from '../../../../src/api/chat';
import { useAuthStore } from '../../../../src/store/authStore';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

function ChannelRow({ channel }: { channel: Conversation }) {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const join = useJoinChannel();
  const isMember = channel.participants.some((p) => p.id === user?.id);

  const open = () => router.push(`/(main)/(app)/chat/${channel.id}` as Href);

  return (
    <Pressable
      onPress={isMember ? open : undefined}
      className="flex-row items-center gap-3 px-4 py-3 border-b"
      style={{ borderBottomColor: c.border + '66' }}
    >
      <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: c.card }}>
        <Ionicons
          name={channel.channel_mode === 'broadcast' ? 'megaphone-outline' : 'radio-outline'}
          size={18}
          color={c.muted}
        />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-[15px]" numberOfLines={1} style={{ color: c.text }}>
          {channel.name || 'Channel'}
        </Text>
        <Text className="text-xs mt-0.5" numberOfLines={1} style={{ color: c.muted }}>
          {channel.participants.length} member{channel.participants.length === 1 ? '' : 's'}
          {channel.channel_mode === 'broadcast' ? ' · broadcast' : ''}
          {channel.description ? ` · ${channel.description}` : ''}
        </Text>
      </View>
      {isMember ? (
        <Pressable onPress={open} className="rounded-full border px-3.5 py-1.5" style={{ borderColor: c.border, backgroundColor: c.surface }}>
          <Text className="text-xs font-semibold" style={{ color: c.muted }}>Open</Text>
        </Pressable>
      ) : (
        <Pressable
          disabled={join.isPending}
          onPress={() =>
            join.mutate(channel.id, {
              onSuccess: open,
              onError: (e) => Alert.alert('Join failed', extractApiError(e)),
            })
          }
          className="rounded-full border px-3.5 py-1.5"
          style={{ borderColor: c.primary, backgroundColor: c.primary }}
        >
          <Text className="text-xs font-semibold" style={{ color: c.bg }}>Join</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function PublicChannelsScreen() {
  const c = useThemeColors();
  const { data, isLoading } = usePublicChannels();

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center gap-3 border-b px-3 pt-14 pb-3" style={{ borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <Text className="font-bold text-base" style={{ color: c.text }}>Public channels</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator className="mt-16" color={c.primary} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(ch) => String(ch.id)}
          renderItem={({ item }) => <ChannelRow channel={item} />}
          ListEmptyComponent={
            <View className="items-center pt-20 px-8">
              <Text className="text-sm" style={{ color: c.muted }}>No public channels yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
