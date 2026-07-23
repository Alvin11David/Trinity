import { View, Text, Modal, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Post } from '../../api/feed';
import { useRepost } from '../../hooks/useFeed';
import { useThemeColors } from '../../hooks/useThemeColors';

function SheetRow({ icon, label, sub, onPress }: { icon: any; label: string; sub?: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 px-5 py-4 active:bg-elevated">
      <Ionicons name={icon} size={20} color={c.text} />
      <View>
        <Text className="text-text text-[15px] font-medium">{label}</Text>
        {!!sub && <Text className="text-textMuted text-xs">{sub}</Text>}
      </View>
    </Pressable>
  );
}

// Action sheet: plain repost vs. quote (opens the composer with the original).
export function RepostSheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const router = useRouter();
  const repost = useRepost();

  const doRepost = () => {
    if (post) repost.mutate({ originalId: post.id });
    onClose();
  };
  const doQuote = () => {
    if (post) router.push(`/(main)/(app)/compose?repostOf=${post.id}` as Href);
    onClose();
  };

  return (
    <Modal transparent visible={!!post} animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable className="bg-surface rounded-t-2xl pt-2 pb-9 border-t border-border">
          <View className="w-10 h-1 bg-border rounded-full self-center mb-2" />
          <SheetRow icon="repeat" label="Repost" sub="Share with your followers" onPress={doRepost} />
          <SheetRow icon="create-outline" label="Quote" sub="Add your own take" onPress={doQuote} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
