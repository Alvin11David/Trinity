import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import type { PostAuthor } from '../../api/feed';

export function displayName(a: PostAuthor) {
  const full = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  return full || a.username;
}

export function Avatar({ author, size = 40 }: { author: PostAuthor; size?: number }) {
  if (author.avatar) {
    return (
      <Image
        source={{ uri: author.avatar }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View className="items-center justify-center rounded-full bg-elevated" style={{ width: size, height: size }}>
      <Text className="text-textSecondary font-semibold" style={{ fontSize: size * 0.4 }}>
        {displayName(author).charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
