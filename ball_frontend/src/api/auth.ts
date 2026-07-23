import { apiClient } from './client';

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  favorite_club?: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export const register = async (payload: RegisterPayload) => {
  const response = await apiClient.post('/api/users/register/', payload);
  return response.data;
};

export const login = async (payload: LoginPayload) => {
  const response = await apiClient.post('/api/users/login/', payload);
  return response.data;
};

export const getProfile = async () => {
  const response = await apiClient.get('/api/users/me/');
  return response.data;
};
