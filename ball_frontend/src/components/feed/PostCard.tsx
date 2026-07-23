import { View, Text, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Post, PostAuthor, ReactionType } from '../../api/feed';
import { usePost } from '../../hooks/useFeed';
import { useReactToPost } from '../../hooks/useReactions';
import { useThemeColors } from '../../hooks/useThemeColors';
import { timeAgo } from '../../lib/time';
import { Avatar, displayName } from './Avatar';
import { PostMediaView } from './PostMediaView';
import { MatchObjectCard } from './MatchObjectCard';
import { ReactionBar } from './ReactionBar';

const SYSTEM_USERNAME = 'ball';

function AuthorRow({ author, createdAt, size = 40 }: { author: PostAuthor; createdAt: string; size?: number }) {
  const router = useRouter();
  const c = useThemeColors();
  // Tapping the author opens their profile; the nested Pressable claims the
  // gesture so the surrounding card's press (→ post detail) doesn't also fire.
  const openProfile = () => router.push(`/(main)/(app)/profile/${author.username}` as Href);
  return (
    <Pressable className="flex-row items-center gap-2" onPress={openProfile}>
      <Avatar author={author} size={size} />
      <View className="flex-1 flex-row items-center flex-wrap gap-x-1">
        <Text className="text-text font-semibold text-[15px]" numberOfLines={1}>
          {displayName(author)}
        </Text>
        {author.username === SYSTEM_USERNAME && <Ionicons name="checkmark-circle" size={14} color={c.primary} />}
        <Text className="text-textMuted text-[13px]" numberOfLines={1}>
          @{author.username} · {timeAgo(createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

// Compact, non-interactive render of a quoted original (repost_of comes back as
// a bare pk, so it's fetched by id).
function QuotedOriginal({ postId }: { postId: number }) {
  const { data, isLoading } = usePost(postId);
  if (!data) {
    return (
      <View className="mt-2 rounded-xl border border-border p-3">
        <Text className="text-textMuted text-xs">{isLoading ? 'Loading…' : 'Post unavailable'}</Text>
      </View>
    );
  }
  return (
    <View className="mt-2 rounded-xl border border-border p-3">
      <AuthorRow author={data.author} createdAt={data.created_at} size={26} />
      {!!data.content && <Text className="text-text text-[14px] mt-1.5">{data.content}</Text>}
      {data.post_type === 'match_object' && data.match_card && <MatchObjectCard card={data.match_card} />}
      <PostMediaView media={data.media} mediaState={data.media_state} />
    </View>
  );
}

// Header + body + engagement for a single post. Shared by normal posts and the
// (resolved) original inside a plain repost.
function CardContents({ post, onRepost }: { post: Post; onRepost?: (post: Post) => void }) {
  const router = useRouter();
  const c = useThemeColors();
  const react = useReactToPost();
  const openDetail = () => router.push(`/(main)/(app)/post/${post.id}` as Href);
  const isQuote = post.repost_of != null && post.content.trim() !== '';

  return (
    <>
      <AuthorRow author={post.author} createdAt={post.created_at} />
      <View className="mt-2 ml-12">
        {!!post.content && <Text className="text-text text-[15px] leading-5">{post.content}</Text>}

        {post.post_type === 'winnie_insight' && (
          <View className="flex-row items-center gap-1 mt-2 self-start rounded-full bg-primary/15 px-2.5 py-1">
            <Ionicons name="sparkles" size={12} color={c.primary} />
            <Text className="text-primary text-[11px] font-semibold">Winnie Insight</Text>
          </View>
        )}

        {post.post_type === 'match_object' && post.match_card && <MatchObjectCard card={post.match_card} />}

        <PostMediaView media={post.media} mediaState={post.media_state} />

        {isQuote && post.repost_of != null && <QuotedOriginal postId={post.repost_of} />}

        <ReactionBar
          post={post}
          onReact={(type: ReactionType) => react.mutate({ postId: post.id, reactionType: type })}
          onComment={openDetail}
          onRepost={() => onRepost?.(post)}
        />
      </View>
    </>
  );
}

// Plain repost: "@user reposted" attribution over the fully-interactive original.
function PlainRepostCard({ post, onRepost }: { post: Post; onRepost?: (post: Post) => void }) {
  const { data: original } = usePost(post.repost_of as number);
  const c = useThemeColors();
  return (
    <View className="border-b border-border px-4 py-3">
      <View className="flex-row items-center gap-1.5 mb-2 ml-1">
        <Ionicons name="repeat" size={13} color={c.muted} />
        <Text className="text-textMuted text-xs">@{post.author.username} reposted</Text>
      </View>
      {original ? (
        <CardContents post={original} onRepost={onRepost} />
      ) : (
        <Text className="text-textMuted text-xs">Loading…</Text>
      )}
    </View>
  );
}

export function PostCard({
  post,
  onRepost,
  onLongPress,
  disableCardPress = false,
}: {
  post: Post;
  onRepost?: (post: Post) => void;
  onLongPress?: (post: Post) => void;
  disableCardPress?: boolean;
}) {
  const router = useRouter();
  const isPlainRepost = post.repost_of != null && post.content.trim() === '';

  if (isPlainRepost) return <PlainRepostCard post={post} onRepost={onRepost} />;

  // On the post's own detail screen, the card shouldn't re-navigate to itself.
  if (disableCardPress) {
    return (
      <View className="border-b border-border px-4 py-3">
        <CardContents post={post} onRepost={onRepost} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/post/${post.id}` as Href)}
      onLongPress={onLongPress ? () => onLongPress(post) : undefined}
      className="border-b border-border px-4 py-3"
    >
      <CardContents post={post} onRepost={onRepost} />
    </Pressable>
  );
}
