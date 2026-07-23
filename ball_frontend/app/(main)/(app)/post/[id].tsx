import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePost } from '../../../../src/hooks/useFeed';
import { useComments, useAddComment } from '../../../../src/hooks/useComments';
import { PostCard } from '../../../../src/components/feed/PostCard';
import { CommentThread } from '../../../../src/components/feed/CommentThread';
import { RepostSheet } from '../../../../src/components/feed/RepostSheet';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';
import type { Post, CommentNode } from '../../../../src/api/feed';

export default function PostDetailScreen() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const post = usePost(postId, { pollWhileProcessing: true });
  const comments = useComments(postId);
  const addComment = useAddComment(postId);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [repostTarget, setRepostTarget] = useState<Post | null>(null);

  const submit = () => {
    const content = text.trim();
    if (!content) return;
    addComment.mutate(
      { content, parent: replyTo?.id ?? null },
      { onSuccess: () => { setText(''); setReplyTo(null); } },
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* header */}
      <View className="flex-row items-center gap-3 px-4 py-2 border-b" style={{ borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <Text className="text-lg font-bold" style={{ color: c.text }}>Post</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {post.isLoading ? (
            <View className="py-24 items-center">
              <ActivityIndicator color={c.primary} />
            </View>
          ) : post.data ? (
            <>
              <PostCard post={post.data} disableCardPress onRepost={setRepostTarget} />
              <Text className="text-xs font-semibold uppercase tracking-wide px-4 pt-4 pb-1" style={{ color: c.muted }}>
                Comments
              </Text>
              {comments.isLoading ? (
                <ActivityIndicator color={c.primary} className="mt-6" />
              ) : (
                <CommentThread comments={comments.data ?? []} onReply={setReplyTo} />
              )}
            </>
          ) : (
            <Text className="text-center mt-24" style={{ color: c.muted }}>Post not found.</Text>
          )}
        </ScrollView>

        {/* comment composer */}
        <View className="border-t" style={{ borderTopColor: c.border, paddingBottom: insets.bottom }}>
          {replyTo && (
            <View className="flex-row items-center justify-between px-4 pt-2">
              <Text className="text-xs" style={{ color: c.muted }}>Replying to @{replyTo.author.username}</Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <Ionicons name="close" size={16} color={c.muted} />
              </Pressable>
            </View>
          )}
          <View className="flex-row items-center gap-2 px-4 py-2">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
              placeholderTextColor={c.muted}
              className="flex-1 rounded-full px-4 py-2 text-[14px]"
              style={{ backgroundColor: c.card, color: c.text }}
              multiline
            />
            <Pressable
              onPress={submit}
              disabled={!text.trim() || addComment.isPending}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: text.trim() ? c.primary : c.card }}
            >
              {addComment.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color={text.trim() ? '#fff' : c.muted} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <RepostSheet post={repostTarget} onClose={() => setRepostTarget(null)} />
    </View>
  );
}
