import { useQuery } from '@tanstack/react-query';
import {
  getPlayerProfile,
  getPlayerMatchHistory,
  getPlayerMarketValueHistory,
  getPlayerTransfers,
} from '../api/playerDetail';

export const usePlayerProfile = (playerId: number) => {
  return useQuery({
    queryKey: ['player-profile', playerId],
    queryFn: () => getPlayerProfile(playerId),
    enabled: !!playerId,
  });
};

export const usePlayerMatchHistory = (playerId: number) => {
  return useQuery({
    queryKey: ['player-match-history', playerId],
    queryFn: () => getPlayerMatchHistory(playerId),
    enabled: !!playerId,
  });
};

export const usePlayerMarketValueHistory = (playerId: number) => {
  return useQuery({
    queryKey: ['player-mv-history', playerId],
    queryFn: () => getPlayerMarketValueHistory(playerId),
    enabled: !!playerId,
  });
};

export const usePlayerTransfers = (playerId: number) => {
  return useQuery({
    queryKey: ['player-transfers', playerId],
    queryFn: () => getPlayerTransfers(playerId),
    enabled: !!playerId,
  });
};
