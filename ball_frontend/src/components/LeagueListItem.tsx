import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useToggleFollowLeague } from '../hooks/useLeagues';
import { useThemeColors } from '../hooks/useThemeColors';
import type { League } from '../api/leagues';

export function LeagueListItem({ league, variant = 'default' }: { league: League; variant?: 'default' | 'compact' }) {
  const toggleFollow = useToggleFollowLeague();
  const router = useRouter();
  const c = useThemeColors();

  const handlePress = () => {
    const href =
      `/(main)/(app)/league/${league.league_id}?season=${league.current_season ?? ''}&name=${encodeURIComponent(league.name)}` as Href;
    router.push(href);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      className={`flex-row items-center bg-surface border border-border rounded-xl px-4 py-3.5 ${
        variant === 'compact' ? 'ml-4' : 'mx-4'
      } mb-2.5`}
    >
      {league.logo ? (
        <Image
          source={{ uri: league.logo }}
          className="w-9 h-9 mr-3"
          resizeMode="contain"
        />
      ) : (
        <View className="w-9 h-9 mr-3 bg-elevated rounded-full" />
      )}

      <View className="flex-1">
        <Text className="text-text text-[15px] font-medium" numberOfLines={1}>
          {league.name}
        </Text>
        <Text className="text-textSecondary text-xs mt-0.5">{league.country_name}</Text>
      </View>

      {league.is_core_league && (
        <View className="bg-primary/15 px-2.5 py-1 rounded-full mr-2.5">
          <Text className="text-primary text-[11px] font-semibold">Winnie</Text>
        </View>
      )}

      <TouchableOpacity
        className={`px-3.5 py-1.5 rounded-full border ${
          league.is_following
            ? 'bg-primary border-primary'
            : 'border-border bg-surface'
        }`}
        onPress={() => toggleFollow.mutate(league.league_id)}
        disabled={toggleFollow.isPending}
        activeOpacity={0.7}
      >
        {toggleFollow.isPending ? (
          <ActivityIndicator
            size="small"
            color={league.is_following ? c.bg : c.muted}
          />
        ) : (
          <Text
            className={`text-xs font-semibold ${
              league.is_following ? 'text-white' : 'text-textSecondary'
            }`}
          >
            {league.is_following ? 'Following' : 'Follow'}
          </Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
