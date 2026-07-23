import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Switch,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { autocomplete, type AutocompleteUser } from '../../../../src/api/search';
import { useDebounce } from '../../../../src/hooks/useDebounce';
import { useCreateConversation } from '../../../../src/hooks/useChat';
import { extractApiError, type ConversationType } from '../../../../src/api/chat';
import { useAuthStore } from '../../../../src/store/authStore';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

function UserPicker({
  selected,
  onToggle,
  multi,
}: {
  selected: AutocompleteUser[];
  onToggle: (u: AutocompleteUser) => void;
  multi: boolean;
}) {
  const c = useThemeColors();
  const me = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const { data, isFetching } = useQuery({
    queryKey: ['userAutocomplete', debounced],
    queryFn: () => autocomplete(debounced, 10),
    enabled: debounced.length >= 1,
  });
  const users = (data?.users ?? []).filter((u) => u.id !== me?.id);
  const selectedIds = new Set(selected.map((u) => u.id));

  return (
    <View className="gap-2">
      {selected.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {selected.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => onToggle(u)}
              className="flex-row items-center gap-1 rounded-full border px-2.5 py-1"
              style={{ backgroundColor: c.primary + '26', borderColor: c.primary + '66' }}
            >
              <Text className="text-xs font-medium" style={{ color: c.primary }}>@{u.username}</Text>
              <Ionicons name="close" size={12} color={c.primary} />
            </Pressable>
          ))}
        </View>
      )}
      <TextInput
        className="border rounded-lg px-3 py-2"
        style={{ backgroundColor: c.surface, borderColor: c.border, color: c.text }}
        placeholder={multi ? 'Search users to add' : 'Search a user'}
        placeholderTextColor={c.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />
      {isFetching && <ActivityIndicator size="small" color={c.primary} />}
      {users.map((u) => (
        <Pressable
          key={u.id}
          onPress={() => {
            onToggle(u);
            if (!multi) setQuery('');
          }}
          className="flex-row items-center justify-between rounded-lg border px-3 py-2"
          style={{ borderColor: c.border + '99' }}
        >
          <Text className="text-sm" style={{ color: c.text }}>@{u.username}</Text>
          {selectedIds.has(u.id) && <Ionicons name="checkmark" size={16} color={c.primary} />}
        </Pressable>
      ))}
    </View>
  );
}

export default function NewConversationScreen() {
  const c = useThemeColors();
  const [kind, setKind] = useState<ConversationType>('direct');
  const [selected, setSelected] = useState<AutocompleteUser[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateConversation();

  const toggleUser = (u: AutocompleteUser) => {
    setError(null);
    setSelected((prev) => {
      const has = prev.some((x) => x.id === u.id);
      if (has) return prev.filter((x) => x.id !== u.id);
      return kind === 'direct' ? [u] : [...prev, u];
    });
  };

  const needsName = kind !== 'direct';
  const canCreate =
    kind === 'direct'
      ? selected.length === 1
      : kind === 'group'
        ? name.trim().length > 0 && selected.length >= 1
        : name.trim().length > 0;

  const submit = () => {
    setError(null);
    create.mutate(
      {
        conversation_type: kind,
        participant_ids: selected.map((u) => u.id),
        ...(needsName ? { name: name.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(kind === 'channel' ? { is_public: isPublic } : {}),
      },
      {
        onSuccess: (conv) => router.replace(`/(main)/(app)/chat/${conv.id}` as Href),
        onError: (e) => setError(extractApiError(e)),
      },
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center gap-3 border-b px-3 pt-14 pb-3" style={{ borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={22} color={c.text} />
        </Pressable>
        <Text className="font-bold text-base" style={{ color: c.text }}>New conversation</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-3" keyboardShouldPersistTaps="handled">
        <View className="flex-row gap-2 mb-4">
          {(
            [
              ['direct', 'DM'],
              ['group', 'Group'],
              ['channel', 'Channel'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => {
                setKind(value);
                setError(null);
                if (value === 'direct' && selected.length > 1) setSelected(selected.slice(0, 1));
              }}
              className={`flex-1 items-center rounded-lg border py-2 ${
                kind === value ? 'border-primary' : 'border-border'
              }`}
              style={{
                backgroundColor: kind === value ? c.primary : c.surface,
                borderColor: kind === value ? c.primary : c.border,
              }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: kind === value ? c.bg : c.muted }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {kind === 'direct' && (
          <Text className="text-xs mb-3" style={{ color: c.muted }}>
            You can message people who follow you back, or mutual contacts.
          </Text>
        )}
        {kind === 'group' && (
          <Text className="text-xs mb-3" style={{ color: c.muted }}>
            Groups need a name and at least one other member.
          </Text>
        )}
        {kind === 'channel' && (
          <Text className="text-xs mb-3" style={{ color: c.muted }}>
            Channels are open spaces — make one public so anyone can find and join it.
          </Text>
        )}

        {needsName && (
          <TextInput
            className="border rounded-lg px-3 py-2 mb-3"
            style={{ backgroundColor: c.surface, borderColor: c.border, color: c.text }}
            placeholder={kind === 'group' ? 'Group name' : 'Channel name'}
            placeholderTextColor={c.muted}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
          />
        )}
        {kind === 'channel' && (
          <>
            <TextInput
              className="border rounded-lg px-3 py-2 mb-3"
              style={{ backgroundColor: c.surface, borderColor: c.border, color: c.text }}
              placeholder="Description (optional)"
              placeholderTextColor={c.muted}
              value={description}
              onChangeText={setDescription}
            />
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm" style={{ color: c.text }}>Public channel</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: c.primary, false: c.muted }}
              />
            </View>
          </>
        )}

        <UserPicker selected={selected} onToggle={toggleUser} multi={kind !== 'direct'} />

        {error && (
          <View className="mt-3 rounded-lg border px-3 py-2" style={{ backgroundColor: '#ef444426', borderColor: '#ef444466' }}>
            <Text className="text-xs" style={{ color: '#ef4444' }}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={submit}
          disabled={!canCreate || create.isPending}
          className="mt-4 mb-10 rounded-lg py-3 items-center"
          style={{ backgroundColor: canCreate ? c.primary : c.border }}
        >
          {create.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold" style={{ color: canCreate ? c.bg : c.muted }}>
              Create
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}
