import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { closeSocket } from '@/lib/socket';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  hospitalId?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (accessToken, refreshToken, user) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ accessToken, refreshToken, user, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          // Drop the realtime connection so no stale events leak across accounts
          closeSocket();
        }
      },
    }),
    {
      name: 'medcore-auth',
    }
  )
);
