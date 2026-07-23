import { FlatList, View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import type { Post } from '../../api/feed';
import { PostCard } from './PostCard';
import { useThemeColors } from '../../hooks/useThemeColors';

export function FeedList({
  posts,
  isLoading,
  isRefetching,
  onRefresh,
  onRepost,
  onEndReached,
  isFetchingNextPage,
  ListHeaderComponent,
  emptyText = 'Nothing here yet.',
}: {
  posts: Post[] | undefined;
  isLoading: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onRepost?: (post: Post) => void;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  ListHeaderComponent?: React.ReactElement;
  emptyText?: string;
}) {
  const c = useThemeColors();
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={posts ?? []}
      keyExtractor={(p) => String(p.id)}
      renderItem={({ item }) => <PostCard post={item} onRepost={onRepost} />}
      ListHeaderComponent={ListHeaderComponent}
      className="bg-background"
      contentContainerStyle={{ paddingBottom: 96 }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator color={c.primary} className="py-6" /> : null
      }
      ListEmptyComponent={
        <View className="items-center justify-center py-24 px-8">
          <Text className="text-textMuted text-sm text-center">{emptyText}</Text>
        </View>
      }
    />
  );
}
