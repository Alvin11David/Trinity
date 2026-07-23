import { View, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { PostMedia, MediaState } from '../../api/feed';
import { VideoPlayer } from './VideoPlayer';
import { useThemeColors } from '../../hooks/useThemeColors';

function ProcessingCard() {
  const c = useThemeColors();
  return (
    <View className="w-full items-center justify-center rounded-xl bg-elevated border border-border py-10" style={{ aspectRatio: 16 / 9 }}>
      <ActivityIndicator color={c.primary} />
      <Text className="text-textSecondary text-xs mt-2">Processing video…</Text>
    </View>
  );
}

function Photo({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }}
      contentFit="cover"
      transition={150}
    />
  );
}

export function PostMediaView({
  media,
  mediaState,
}: {
  media: PostMedia[];
  mediaState: MediaState;
}) {
  const c = useThemeColors();
  if (!media || media.length === 0) return null;

  // Whole-post processing gate (video still transcoding).
  if (mediaState === 'processing') return <View className="mt-3"><ProcessingCard /></View>;

  return (
    <View className="mt-3 gap-2">
      {media.map((m) => {
        if (m.status === 'processing') {
          return <ProcessingCard key={m.id} />;
        }
        if (m.status === 'failed') {
          return (
            <View key={m.id} className="w-full flex-row items-center gap-2 rounded-xl bg-elevated border border-border p-3">
              <Ionicons name="warning-outline" size={16} color={c.red500} />
              <Text className="text-redCard text-xs">Media failed to process</Text>
            </View>
          );
        }
        if (m.media_type === 'video' && m.mux_playback_id) {
          return <VideoPlayer key={m.id} playbackId={m.mux_playback_id} />;
        }
        if (m.media_type === 'photo' && m.url) {
          return <Photo key={m.id} uri={m.url} />;
        }
        return null;
      })}
    </View>
  );
}
