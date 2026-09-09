import { createContext, useContext } from 'react';
import type { User } from '../api';

export type AuthState = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  adminLogin: (username: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
  setSession: (token: string, user: User) => void;
};

export const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider required');
  return value;
};
