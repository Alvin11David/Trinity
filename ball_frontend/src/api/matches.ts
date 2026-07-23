import { apiClient } from './client';
import type { Match } from './leagueDetail';

export const getMatchesByDate = async (date: string, season: number) => {
  const response = await apiClient.get<Match[]>('/api/matches/', { params: { date, season } });
  return response.data;
};
