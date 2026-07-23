import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { createPost } from '../../../src/api/feed';
import { requestUploadUrl, uploadFileToUrl, finalizePhoto } from '../../../src/api/media';
import { feedKeys, usePost } from '../../../src/hooks/useFeed';
import { useThemeColors } from '../../../src/hooks/useThemeColors';

const MAX_CHARS = 500;
const MAX_VIDEO_SECONDS = 140; // matches backend MUX_MAX_VIDEO_DURATION

export default function ComposeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { repostOf } = useLocalSearchParams<{ repostOf?: string }>();
  const repostOfId = repostOf ? Number(repostOf) : null;
  const quoted = usePost(repostOfId ?? 0);
  const c = useThemeColors();

  const [content, setContent] = useState('');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const pick = async (kind: 'images' | 'videos') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo/video access to attach media.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [kind],
      quality: 0.85,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      if (a.type === 'video' && a.duration && a.duration / 1000 > MAX_VIDEO_SECONDS) {
        Alert.alert('Video too long', `Videos must be ${MAX_VIDEO_SECONDS}s or shorter.`);
        return;
      }
      setAsset(a);
    }
  };

  const canPost = (content.trim().length > 0 || !!asset || repostOfId != null) && !submitting;

  const submit = async () => {
    if (!canPost) return;
    setSubmitting(true);
    setProgress(0);
    try {
      const created = await createPost({
        content: content.trim(),
        post_type: 'text',
        repost_of: repostOfId,
      });

      if (asset) {
        const isVideo = asset.type === 'video';
        const contentType = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
        const cred = await requestUploadUrl({
          postId: created.id,
          mediaType: isVideo ? 'video' : 'photo',
          contentType,
        });
        await uploadFileToUrl(cred.upload_url, asset.uri, contentType, setProgress);
        // Photos finalize immediately; videos flip processing→ready via Mux webhook.
        if (!isVideo) await finalizePhoto(cred.media_id);
      }

      qc.invalidateQueries({ queryKey: feedKeys.following });
      qc.invalidateQueries({ queryKey: feedKeys.forYou });
      router.back();
    } catch (e: any) {
      const msg = e?.response?.data
        ? JSON.stringify(e.response.data)
        : e?.message ?? 'Could not post.';
      Alert.alert('Post failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} disabled={submitting} hitSlop={8}>
          <Text style={{ color: c.muted, fontSize: 15 }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={!canPost}
          style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: canPost ? c.primary : c.card }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: canPost ? c.bg : c.muted }}>Post</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={content}
          onChangeText={(t) => t.length <= MAX_CHARS && setContent(t)}
          placeholder={repostOfId != null ? 'Add a comment…' : "What's the take?"}
          placeholderTextColor={c.muted}
          multiline
          autoFocus
          style={{ color: c.text, fontSize: 17, lineHeight: 24, minHeight: 100, textAlignVertical: 'top' }}
          editable={!submitting}
        />

        {/* quoted original preview */}
        {repostOfId != null && quoted.data && (
          <View style={{ marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>@{quoted.data.author.username}</Text>
            {!!quoted.data.content && (
              <Text style={{ color: c.text, fontSize: 14, marginTop: 4 }} numberOfLines={3}>{quoted.data.content}</Text>
            )}
          </View>
        )}

        {/* media preview */}
        {asset && (
          <View style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
            {asset.type === 'video' ? (
              <View style={{ height: 192, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }}>
                <Ionicons name="videocam" size={32} color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Video ready to upload</Text>
              </View>
            ) : (
              <Image source={{ uri: asset.uri }} style={{ width: '100%', height: 220 }} contentFit="cover" />
            )}
            <Pressable
              onPress={() => setAsset(null)}
              disabled={submitting}
              style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* upload progress */}
        {submitting && asset && (
          <View style={{ marginTop: 12 }}>
            <View style={{ height: 4, borderRadius: 999, backgroundColor: c.card, overflow: 'hidden' }}>
              <View style={{ height: 4, backgroundColor: c.primary, width: `${Math.round(progress * 100)}%` }} />
            </View>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
              {progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Finishing up…'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* attach toolbar */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: insets.bottom + 12 }}
      >
        <Pressable onPress={() => pick('images')} disabled={submitting || !!asset} hitSlop={8}>
          <Ionicons name="image-outline" size={24} color={asset ? c.muted : c.primary} />
        </Pressable>
        <Pressable onPress={() => pick('videos')} disabled={submitting || !!asset} hitSlop={8}>
          <Ionicons name="videocam-outline" size={24} color={asset ? c.muted : c.primary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 12, color: content.length > MAX_CHARS - 40 ? '#eab308' : c.muted }}>
          {MAX_CHARS - content.length}
        </Text>
      </View>
    </View>
  );
}
