import { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LeagueListItem } from './LeagueListItem';
import { useCountries } from '../hooks/useCountries';
import { getFlagUrl } from '../lib/flags';
import { useThemeColors } from '../hooks/useThemeColors';
import type { CountryGroup } from '../api/leagues';

export function CountryLeagueGroup({ group }: { group: CountryGroup }) {
  const [expanded, setExpanded] = useState(false);
  const { data: countries } = useCountries();
  const flagUrl = getFlagUrl(group.country_name, countries);
  const c = useThemeColors();

  return (
    <View className="mx-4 mb-2.5">
      <TouchableOpacity
        className="flex-row items-center justify-between bg-surface border border-border rounded-xl px-4 py-3.5"
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center flex-1">
          {flagUrl ? (
            <Image
              source={{ uri: flagUrl }}
              className="w-7 h-5 mr-3 rounded-sm"
              resizeMode="cover"
            />
          ) : (
            <View className="w-7 h-5 mr-3 bg-elevated rounded-sm" />
          )}
          <Text className="text-text text-[15px] flex-1" numberOfLines={1}>
            {group.country_name}
          </Text>
          <Text className="text-textMuted text-xs mr-2">
            {group.leagues.length}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={c.muted}
        />
      </TouchableOpacity>

      {expanded && (
        <View className="mt-1.5">
          {group.leagues.map((league) => (
            <LeagueListItem key={league.id} league={league} variant="compact" />
          ))}
        </View>
      )}
    </View>
  );
}
