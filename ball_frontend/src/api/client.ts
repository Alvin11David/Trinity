import axios from 'axios';
import { storage } from '../lib/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await storage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await storage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/users/token/refresh/`, {
            refresh: refreshToken,
          });
          const newAccessToken = response.data.access;
          await storage.setItem('access_token', newAccessToken);
          error.config.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient.request(error.config);
        } catch (refreshError) {
          await storage.deleteItem('access_token');
          await storage.deleteItem('refresh_token');
        }
      }
    }
    return Promise.reject(error);
  }
);
