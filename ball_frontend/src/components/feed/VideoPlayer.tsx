import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { muxStreamUrl } from '../../api/media';

/**
 * Plays a Mux asset by playback id via HLS (Mux's recommended path for Expo).
 * expo-video's VideoView natively handles adaptive-bitrate .m3u8 — no eject.
 */
export function VideoPlayer({
  playbackId,
  aspectRatio = 16 / 9,
}: {
  playbackId: string;
  aspectRatio?: number;
}) {
  const player = useVideoPlayer(muxStreamUrl(playbackId), (p) => {
    p.loop = false;
    p.muted = true; // autoplay-friendly default; user unmutes via controls
  });

  return (
    <View className="w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls
        allowsFullscreen
      />
    </View>
  );
}
