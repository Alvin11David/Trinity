import { View, Text, Pressable } from 'react-native';
import type { CommentNode } from '../../api/feed';
import { Avatar, displayName } from './Avatar';
import { timeAgo } from '../../lib/time';

const MAX_INDENT_DEPTH = 4; // cap visual nesting so deep threads stay readable

function CommentItem({
  node,
  depth,
  onReply,
}: {
  node: CommentNode;
  depth: number;
  onReply: (node: CommentNode) => void;
}) {
  const indented = depth > 0;
  return (
    <View className={indented ? 'ml-3 border-l border-border pl-3' : ''}>
      <View className="flex-row gap-2 py-2.5">
        <Avatar author={node.author} size={28} />
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap gap-x-1">
            <Text className="text-text text-[13px] font-semibold">{displayName(node.author)}</Text>
            <Text className="text-textMuted text-xs">@{node.author.username} · {timeAgo(node.created_at)}</Text>
          </View>
          <Text className="text-text text-[14px] leading-5 mt-0.5">{node.content}</Text>
          <Pressable onPress={() => onReply(node)} hitSlop={6} className="self-start mt-1">
            <Text className="text-textMuted text-xs font-medium">Reply</Text>
          </Pressable>
        </View>
      </View>
      {node.replies.map((child) => (
        <CommentItem
          key={child.id}
          node={child}
          depth={Math.min(depth + 1, MAX_INDENT_DEPTH)}
          onReply={onReply}
        />
      ))}
    </View>
  );
}

export function CommentThread({
  comments,
  onReply,
}: {
  comments: CommentNode[];
  onReply: (node: CommentNode) => void;
}) {
  if (comments.length === 0) {
    return (
      <View className="items-center py-10">
        <Text className="text-textMuted text-sm">No comments yet. Start the conversation.</Text>
      </View>
    );
  }
  return (
    <View className="px-4">
      {comments.map((c) => (
        <CommentItem key={c.id} node={c} depth={0} onReply={onReply} />
      ))}
    </View>
  );
}
