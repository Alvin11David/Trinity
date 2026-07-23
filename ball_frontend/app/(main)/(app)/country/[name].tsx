import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getLeagues } from '../../../../src/api/leagues';
import { useCountries } from '../../../../src/hooks/useCountries';
import { getFlagUrl } from '../../../../src/lib/flags';
import { LeagueListItem } from '../../../../src/components/LeagueListItem';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

export default function CountryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  const { name } = useLocalSearchParams<{ name: string }>();
  const country = name ?? '';

  const { data: countries } = useCountries();
  const flag = getFlagUrl(country, countries);

  const { data: leagues, isLoading } = useQuery({
    queryKey: ['leagues', 'by-country-name', country],
    queryFn: () => getLeagues({ country }),
    enabled: country.length > 0,
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        {flag && <Image source={{ uri: flag }} style={{ width: 28, height: 20 }} contentFit="cover" />}
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, flex: 1 }} numberOfLines={1}>
          {country}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={leagues ?? []}
          keyExtractor={(l) => String(l.league_id)}
          renderItem={({ item }) => <LeagueListItem league={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No leagues found for {country}.</Text>
          }
        />
      )}
    </View>
  );
}
