import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { useThemeColors } from '../../hooks/useThemeColors';

export interface PickerRow {
  key: string;
  label: string;
  logo?: string | null;
}

/**
 * Generic search-as-you-type picker for a single optional favorite (team or
 * league). Search, a result list, and an explicit Clear — unsetting is as
 * reachable as setting. The two favorites use two independent instances; this
 * component knows nothing about which is which.
 */
export function FavoritePickerModal<T>({
  visible,
  title,
  placeholder,
  search,
  toRow,
  hasCurrent,
  onSelect,
  onClear,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  toRow: (item: T) => PickerRow;
  hasCurrent: boolean;
  onSelect: (item: T) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);
  const c = useThemeColors();

  const results = useQuery({
    queryKey: ['favorite-picker', title, debounced],
    queryFn: () => search(debounced.trim()),
    enabled: visible && debounced.trim().length >= 1,
  });

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center gap-3 px-4 py-2 border-b border-border">
          <Pressable onPress={close} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
          <Text className="text-text text-lg font-bold">{title}</Text>
        </View>

        <View className="px-4 py-2">
          <View className="flex-row items-center bg-elevated rounded-full px-3">
            <Ionicons name="search" size={16} color={c.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={c.muted}
              className="flex-1 text-text text-[14px] px-2 py-2.5"
              autoFocus
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Explicit Clear — only meaningful when something is currently set. */}
        {hasCurrent && (
          <Pressable
            onPress={() => {
              onClear();
              close();
            }}
            className="flex-row items-center gap-2 px-4 py-3 border-b border-border"
          >
            <View className="w-9 h-9 rounded-full bg-elevated items-center justify-center">
              <Ionicons name="close" size={18} color={c.red500} />
            </View>
            <Text className="text-redCard text-[15px] font-medium">Clear selection</Text>
          </Pressable>
        )}

        {results.isLoading && debounced.trim().length >= 1 ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <FlatList
            data={results.data ?? []}
            keyExtractor={(item) => toRow(item).key}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const row = toRow(item);
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    close();
                  }}
                  className="flex-row items-center gap-3 px-4 py-3 border-b border-border"
                >
                  {row.logo ? (
                    <Image source={{ uri: row.logo }} style={{ width: 32, height: 32 }} contentFit="contain" />
                  ) : (
                    <View className="w-8 h-8 rounded-full bg-elevated items-center justify-center">
                      <Ionicons name="football-outline" size={16} color={c.muted} />
                    </View>
                  )}
                  <Text className="text-text text-[15px] flex-1" numberOfLines={1}>{row.label}</Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              debounced.trim().length >= 1 ? (
                <Text className="text-textMuted text-center mt-8">No matches for “{debounced.trim()}”.</Text>
              ) : (
                <Text className="text-textMuted text-center mt-8">Start typing to search.</Text>
              )
            }
          />
        )}
      </View>
    </Modal>
  );
}
