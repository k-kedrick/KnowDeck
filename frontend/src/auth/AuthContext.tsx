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

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    login: async (username, password) => {
      const result = await api.memberLogin(username, password);
      localStorage.setItem('kb_token', result.token);
      setUser(result.user);
    },
    changePassword: async (currentPassword, newPassword) => {
      try {
        const result = await api.memberChangePassword(currentPassword, newPassword);
        localStorage.setItem('kb_token', result.token);
        setUser(result.user);
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
