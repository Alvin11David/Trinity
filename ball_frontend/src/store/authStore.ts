import { create } from 'zustand';
import { storage } from '../lib/storage';
import { login as loginApi, register as registerApi, getProfile } from '../api/auth';

interface User {
  id: number;
  username: string;
  email: string;
  favorite_club?: string;
  bio?: string;
  avatar?: string;
  banner?: string | null;
  favorite_team_id?: number | null;
  favorite_team_name?: string;
  favorite_team_logo?: string | null;
  favorite_league?: number | null;
  favorite_league_name?: string | null;
  favorite_league_logo?: string | null;
  followers_count?: number;
  following_count?: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, favoriteClub?: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username, password) => {
    const data = await loginApi({ username, password });
    await storage.setItem('access_token', data.access);
    await storage.setItem('refresh_token', data.refresh);
    const profile = await getProfile();
    set({ user: profile, isAuthenticated: true });
  },

  register: async (username, email, password, favoriteClub) => {
    const data = await registerApi({ username, email, password, favorite_club: favoriteClub });
    await storage.setItem('access_token', data.access);
    await storage.setItem('refresh_token', data.refresh);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    await storage.deleteItem('access_token');
    await storage.deleteItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const token = await storage.getItem('access_token');
    if (token) {
      try {
        const profile = await getProfile();
        set({ user: profile, isAuthenticated: true, isLoading: false });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },

  // Re-pull /me/ after an edit so the drawer and other consumers stay in sync.
  refreshUser: async () => {
    try {
      const profile = await getProfile();
      set({ user: profile });
    } catch {
      /* keep the current user if the refresh fails */
    }
  },
}));
