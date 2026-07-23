import { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Post, ReactionType } from '../../api/feed';
import { REACTIONS, reactionByType } from '../../lib/reactions';
import { useThemeColors } from '../../hooks/useThemeColors';

function BarButton({
  icon,
  count,
  color,
  onPress,
  onLongPress,
}: {
  icon: React.ReactNode;
  count?: number;
  color?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={8}
      className="flex-row items-center gap-1.5"
    >
      {icon}
      {count != null && count > 0 && (
        <Text className="text-xs font-medium" style={{ color }}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

export function ReactionBar({
  post,
  onReact,
  onComment,
  onRepost,
}: {
  post: Post;
  onReact: (type: ReactionType) => void;
  onComment: () => void;
  onRepost: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const active = reactionByType(post.user_reaction);
  const c = useThemeColors();

  const openPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setPickerOpen(true);
  };

  const pick = (type: ReactionType) => {
    Haptics.selectionAsync().catch(() => {});
    setPickerOpen(false);
    onReact(type);
  };

  // Tap the reaction button: if already reacted, tapping toggles it off (re-send
  // same type = server removes it); otherwise default to the first reaction.
  const tapReact = () => onReact(post.user_reaction ?? REACTIONS[0].type);

  return (
    <View className="flex-row items-center justify-between mt-3 pr-6">
      <BarButton
        onPress={tapReact}
        onLongPress={openPicker}
        color={active?.color ?? c.muted}
        count={post.reactions_count}
        icon={
          active ? (
            <Text style={{ fontSize: 15 }}>{active.emoji}</Text>
          ) : (
            <Ionicons name="happy-outline" size={18} color={c.muted} />
          )
        }
      />

      <BarButton
        onPress={onComment}
        count={post.comments_count}
        icon={<Ionicons name="chatbubble-outline" size={17} color={c.muted} />}
      />

      <BarButton
        onPress={onRepost}
        count={post.reposts_count}
        color={c.primary}
        icon={<Ionicons name="repeat" size={19} color={c.muted} />}
      />

      <BarButton
        icon={<Ionicons name="share-outline" size={17} color={c.muted} />}
      />

      {/* Long-press tapback picker */}
      <Modal transparent visible={pickerOpen} animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/40" onPress={() => setPickerOpen(false)}>
          <View className="flex-row gap-2 rounded-full bg-elevated border border-border px-3 py-2.5">
            {REACTIONS.map((r) => {
              const selected = post.user_reaction === r.type;
              return (
                <Pressable
                  key={r.type}
                  onPress={() => pick(r.type)}
                  className={`items-center px-2.5 py-1.5 rounded-full ${selected ? 'bg-primary/20' : ''}`}
                >
                  <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
                  <Text className="text-textMuted text-[10px] mt-0.5">{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
