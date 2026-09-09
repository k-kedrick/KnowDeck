import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api';
import type { User } from '../api';
import { AuthContext } from './useAuth';
import type { AuthState } from './useAuth';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('kb_token')) {
      setLoading(false);
      return;
    }
    api.memberMe()
      .then(setUser)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) localStorage.removeItem('kb_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const setSession = (token: string, newUser: User) => {
    localStorage.setItem('kb_token', token);
    setUser(newUser);
  };

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    setSession,
    login: async (username, password) => {
      const result = await api.memberLogin(username, password);
      setSession(result.token, result.user);
    },
    adminLogin: async (username, password) => {
      const result = await api.login(username, password);
      setSession(result.token, result.user);
    },
    changePassword: async (currentPassword, newPassword) => {
      try {
        const result = await api.memberChangePassword(currentPassword, newPassword);
        setSession(result.token, result.user);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem('kb_token');
          setUser(null);
        }
        throw error;
      }
    },
    logout: () => {
      localStorage.removeItem('kb_token');
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
