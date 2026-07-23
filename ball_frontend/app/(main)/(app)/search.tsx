import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSearch, useAutocomplete, useTrends } from '../../../src/hooks/useSearch';
import { useDebounce } from '../../../src/hooks/useDebounce';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import { PostCard } from '../../../src/components/feed/PostCard';
import { RepostSheet } from '../../../src/components/feed/RepostSheet';
import type { SearchTab, MatchSearchCard } from '../../../src/api/search';
import type { Post, PostAuthor } from '../../../src/api/feed';

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'latest', label: 'Latest' },
  { key: 'people', label: 'People' },
  { key: 'matches', label: 'Matches' },
  { key: 'media', label: 'Media' },
];

function PeopleRow({ user }: { user: PostAuthor }) {
  const router = useRouter();
  const c = useThemeColors();
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/profile/${user.username}` as Href)}
      className="flex-row items-center gap-3 px-4 py-3 border-b"
      style={{ borderBottomColor: c.border }}
    >
      {user.avatar ? (
        <Image source={{ uri: user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
      ) : (
        <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: c.card }}>
          <Text className="font-semibold" style={{ color: c.muted }}>{user.username.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="font-semibold text-[15px]" style={{ color: c.text }}>
          {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
        </Text>
        <Text className="text-xs" style={{ color: c.muted }}>@{user.username}</Text>
      </View>
    </Pressable>
  );
}

function MatchRow({ card }: { card: MatchSearchCard }) {
  const router = useRouter();
  const c = useThemeColors();
  const scored = card.home_score != null && card.away_score != null;
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/match/${card.id}` as Href)}
      className="flex-row items-center gap-3 px-4 py-3 border-b"
      style={{ borderBottomColor: c.border }}
    >
      <Ionicons name="football-outline" size={18} color={c.muted} />
      <View className="flex-1">
        <Text className="text-[14px] font-medium" style={{ color: c.text }} numberOfLines={1}>
          {card.home_team} {scored ? `${card.home_score}–${card.away_score}` : 'vs'} {card.away_team}
        </Text>
        <Text className="text-xs" style={{ color: c.muted }}>{card.league ?? ''}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.muted} />
    </Pressable>
  );
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  // A prefilled `q` (e.g. tapping a profile's favorite team/league badge) opens
  // Search already run on Top results.
  const { q: initialQ } = useLocalSearchParams<{ q?: string }>();

  const [query, setQuery] = useState(initialQ ?? '');
  const [submitted, setSubmitted] = useState(initialQ ?? '');
  const [tab, setTab] = useState<SearchTab>('top');
  const [repostTarget, setRepostTarget] = useState<Post | null>(null);

  const debouncedQuery = useDebounce(query, 250);
  const typeahead = useAutocomplete(submitted ? '' : debouncedQuery);
  const trends = useTrends();
  const results = useSearch(submitted, tab);

  const runSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSubmitted(trimmed);
  };

  const renderResults = () => {
    if (results.isLoading) return <ActivityIndicator color={c.primary} className="mt-10" />;
    const data = results.data?.results ?? [];
    if (data.length === 0) {
      return <Text className="text-center mt-10" style={{ color: c.muted }}>No results for "{submitted}".</Text>;
    }
    if (tab === 'people') {
      return (
        <FlatList
          data={data as PostAuthor[]}
          keyExtractor={(u) => String(u.id)}
          renderItem={({ item }) => <PeopleRow user={item} />}
        />
      );
    }
    if (tab === 'matches') {
      return (
        <FlatList
          data={data as MatchSearchCard[]}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => <MatchRow card={item} />}
        />
      );
    }
    // top / latest / media → posts
    return (
      <FlatList
        data={data as Post[]}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <PostCard post={item} onRepost={setRepostTarget} />}
      />
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* search bar */}
      <View className="flex-row items-center gap-2 px-4 py-2">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View className="flex-1 flex-row items-center rounded-full px-3" style={{ backgroundColor: c.card }}>
          <Ionicons name="search" size={16} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (submitted) setSubmitted(''); // typing again returns to typeahead
            }}
            onSubmitEditing={() => runSearch(query)}
            placeholder="Search posts, people, matches"
            placeholderTextColor={c.muted}
            className="flex-1 text-[14px] px-2 py-2.5"
            style={{ color: c.text }}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setSubmitted(''); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {submitted ? (
        // ---- Full results with 5 tabs ----
        <View className="flex-1">
          <View className="flex-row border-b" style={{ borderBottomColor: c.border }}>
            {TABS.map((t) => (
              <Pressable key={t.key} onPress={() => setTab(t.key)} className="flex-1 items-center py-2.5">
                <Text
                  className="text-[13px]"
                  style={{ color: tab === t.key ? c.text : c.muted, fontWeight: tab === t.key ? 'bold' : undefined }}
                >
                  {t.label}
                </Text>
                {tab === t.key && <View className="absolute bottom-0 h-0.5 w-8 rounded-full" style={{ backgroundColor: c.primary }} />}
              </Pressable>
            ))}
          </View>
          <View className="flex-1">{renderResults()}</View>
        </View>
      ) : query.trim().length > 0 ? (
        // ---- Typeahead suggestions ----
        <ScrollView keyboardShouldPersistTaps="handled">
          {typeahead.data?.users.map((u) => (
            <Pressable
              key={`u-${u.id}`}
              onPress={() => runSearch(u.username)}
              className="flex-row items-center gap-3 px-4 py-2.5"
            >
              <Ionicons name="person-outline" size={16} color={c.muted} />
              <Text className="text-[14px]" style={{ color: c.text }}>@{u.username}</Text>
            </Pressable>
          ))}
          {typeahead.data?.hashtags.map((h) => (
            <Pressable
              key={`h-${h.tag}`}
              onPress={() => runSearch(`#${h.tag}`)}
              className="flex-row items-center gap-3 px-4 py-2.5"
            >
              <Ionicons name="pricetag-outline" size={16} color={c.muted} />
              <Text className="text-[14px]" style={{ color: c.text }}>#{h.tag}</Text>
              <Text className="text-xs" style={{ color: c.muted }}>{h.count}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        // ---- Trends (empty state) ----
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text className="text-base font-bold px-4 pt-4 pb-2" style={{ color: c.text }}>Trending</Text>
          {trends.isLoading ? (
            <ActivityIndicator color={c.primary} className="mt-6" />
          ) : (trends.data ?? []).length === 0 ? (
            <Text className="text-sm px-4" style={{ color: c.muted }}>No trends yet.</Text>
          ) : (
            trends.data!.map((h, i) => (
              <Pressable
                key={h.tag}
                onPress={() => runSearch(`#${h.tag}`)}
                className="px-4 py-2.5 border-b"
                style={{ borderBottomColor: c.border }}
              >
                <Text className="text-xs" style={{ color: c.muted }}>{i + 1} · Trending</Text>
                <Text className="text-[15px] font-semibold" style={{ color: c.text }}>#{h.tag}</Text>
                <Text className="text-xs" style={{ color: c.muted }}>{h.count} posts</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <RepostSheet post={repostTarget} onClose={() => setRepostTarget(null)} />
    </View>
  );
}
