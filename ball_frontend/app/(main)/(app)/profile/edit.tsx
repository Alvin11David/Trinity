import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../../../src/store/authStore';
import { useUpdateProfile } from '../../../../src/hooks/useProfile';
import { requestProfileImageUpload, finalizeProfileImage, type ProfileImageKind } from '../../../../src/api/profile';
import { uploadFileToUrl } from '../../../../src/api/media';
import { searchTeams, getLeagues, type TeamResult, type League } from '../../../../src/api/leagues';
import { FavoritePickerModal } from '../../../../src/components/profile/FavoritePickerModal';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const update = useUpdateProfile();

  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [banner, setBanner] = useState<string | null>(user?.banner ?? null);

  const [teamId, setTeamId] = useState<number | null>(user?.favorite_team_id ?? null);
  const [teamName, setTeamName] = useState<string>(user?.favorite_team_name ?? '');
  const [leagueId, setLeagueId] = useState<number | null>(user?.favorite_league ?? null);
  const [leagueName, setLeagueName] = useState<string | null>(user?.favorite_league_name ?? null);
  const [leagueLogo, setLeagueLogo] = useState<string | null>(user?.favorite_league_logo ?? null);
  const [teamLogo, setTeamLogo] = useState<string | null>(user?.favorite_team_logo ?? null);
  const [picker, setPicker] = useState<'team' | 'league' | null>(null);

  const [uploading, setUploading] = useState<ProfileImageKind | null>(null);
  const [progress, setProgress] = useState(0);

  const pickAndUpload = async (kind: ProfileImageKind) => {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'avatar' ? [1, 1] : [3, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'image/jpeg';
    setUploading(kind);
    setProgress(0);
    try {
      const cred = await requestProfileImageUpload(kind, contentType);
      await uploadFileToUrl(cred.upload_url, asset.uri, contentType, setProgress);
      const updated = await finalizeProfileImage(kind, cred.storage_key);
      if (kind === 'avatar') setAvatar(updated.avatar ?? null);
      else setBanner(updated.banner ?? null);
      await refreshUser();
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = data?.error || (Array.isArray(data) ? data[0] : data?.detail) || e?.message || 'Could not upload image.';
      Alert.alert('Upload failed', String(msg));
    } finally {
      setUploading(null);
    }
  };

  const save = () => {
    const trimmedUser = username.trim();
    if (!trimmedUser) {
      Alert.alert('Username required', 'Your username cannot be blank.');
      return;
    }
    update.mutate(
      {
        username: trimmedUser,
        bio: bio.trim(),
        favorite_team_id: teamId,
        favorite_team_name: teamId ? teamName : '',
        favorite_team_logo: teamId ? teamLogo : null,
        favorite_league: leagueId,
      },
      {
        onSuccess: async () => {
          await refreshUser();
          router.back();
        },
        onError: (e: any) => {
          const data = e?.response?.data;
          const msg =
            data?.username?.[0] ||
            (Array.isArray(data) ? data[0] : data?.detail) ||
            'Could not save your changes.';
          Alert.alert('Save failed', String(msg));
        },
      },
    );
  };

  const initial = (username || '?').charAt(0).toUpperCase();
  const busy = uploading !== null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Edit Profile</Text>
        </View>
        <Pressable
          onPress={save}
          disabled={update.isPending || busy}
          style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: busy ? c.card : c.primary }}
        >
          {update.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontWeight: '700', fontSize: 13, color: busy ? c.muted : '#fff' }}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => pickAndUpload('banner')}>
          {banner ? (
            <Image source={{ uri: banner }} style={{ width: '100%', height: 140 }} contentFit="cover" />
          ) : (
            <View style={{ height: 140, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={26} color={c.muted} />
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>Add a header image</Text>
            </View>
          )}
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            {uploading === 'banner' ? (
              <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ fontSize: 12, color: '#fff' }}>{Math.round(progress * 100)}%</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            )}
          </View>
        </Pressable>

        <View style={{ paddingHorizontal: 16, marginTop: -36 }}>
          <Pressable onPress={() => pickAndUpload('avatar')} style={{ alignSelf: 'flex-start' }}>
            {avatar ? (
              <Image
                source={{ uri: avatar }}
                style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: c.border }}
              />
            ) : (
              <View
                style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: c.border, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 30, fontWeight: '700', color: c.muted }}>{initial}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              {uploading === 'avatar' ? (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{Math.round(progress * 100)}%</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 999, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              )}
            </View>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="username"
            placeholderTextColor={c.muted}
            style={{ backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: c.text, marginBottom: 20 }}
          />

          <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself"
            placeholderTextColor={c.muted}
            multiline
            maxLength={280}
            style={{ backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: c.text, minHeight: 96, marginBottom: 4 }}
          />
          <Text style={{ fontSize: 12, color: c.muted, textAlign: 'right', marginBottom: 24 }}>{bio.length}/280</Text>

          <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Favorites</Text>

          <Pressable
            onPress={() => setPicker('team')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 }}
          >
            {teamId && teamLogo ? (
              <Image source={{ uri: teamLogo }} style={{ width: 26, height: 26 }} contentFit="contain" />
            ) : (
              <Ionicons name="shield-outline" size={22} color={c.muted} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: c.muted }}>Favorite Team</Text>
              <Text style={{ fontSize: 15, color: teamId ? c.text : c.muted }} numberOfLines={1}>
                {teamId ? teamName : 'None'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>

          <Pressable
            onPress={() => setPicker('league')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24 }}
          >
            {leagueId && leagueLogo ? (
              <Image source={{ uri: leagueLogo }} style={{ width: 26, height: 26 }} contentFit="contain" />
            ) : (
              <Ionicons name="trophy-outline" size={22} color={c.muted} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: c.muted }}>Favorite League</Text>
              <Text style={{ fontSize: 15, color: leagueId ? c.text : c.muted }} numberOfLines={1}>
                {leagueId ? leagueName : 'None'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        </View>
      </ScrollView>

      <FavoritePickerModal<TeamResult>
        visible={picker === 'team'}
        title="Favorite Team"
        placeholder="Search teams"
        hasCurrent={teamId != null}
        search={searchTeams}
        toRow={(t) => ({ key: String(t.team_id), label: t.team_name, logo: t.team_logo })}
        onSelect={(t) => {
          setTeamId(t.team_id);
          setTeamName(t.team_name);
          setTeamLogo(t.team_logo);
        }}
        onClear={() => {
          setTeamId(null);
          setTeamName('');
          setTeamLogo(null);
        }}
        onClose={() => setPicker(null)}
      />

      <FavoritePickerModal<League>
        visible={picker === 'league'}
        title="Favorite League"
        placeholder="Search leagues"
        hasCurrent={leagueId != null}
        search={(q) => getLeagues({ search: q })}
        toRow={(l) => ({ key: String(l.id), label: l.name, logo: l.logo })}
        onSelect={(l) => {
          setLeagueId(l.id);
          setLeagueName(l.name);
          setLeagueLogo(l.logo);
        }}
        onClear={() => {
          setLeagueId(null);
          setLeagueName(null);
          setLeagueLogo(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}
