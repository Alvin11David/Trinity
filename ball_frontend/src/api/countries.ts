import { apiClient } from './client';

export interface Country {
  id: number;
  name: string;
  code: string | null;
  flag: string | null;
}

export const getCountries = async () => {
  const response = await apiClient.get<Country[]>('/api/players/countries/');
  return response.data;
};
