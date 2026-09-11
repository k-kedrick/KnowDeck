import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api';
import type { User } from '../api';
import { AuthContext } from './useAuth';
import type { AuthState } from './useAuth';

const hasStoredSession = () => Boolean(localStorage.getItem('kb_token'));

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasStoredSession);

  useEffect(() => {
    const token = localStorage.getItem('kb_token');
    if (!token) return;
    const controller = new AbortController();
    api.memberMe(controller.signal)
      .then((nextUser) => {
        if (!controller.signal.aborted && localStorage.getItem('kb_token') === token) setUser(nextUser);
      })
      .catch((error) => {
        if (!controller.signal.aborted && localStorage.getItem('kb_token') === token && error instanceof ApiError && error.status === 401) {
          localStorage.removeItem('kb_token');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && localStorage.getItem('kb_token') === token) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const setSession = (token: string, newUser: User) => {
    localStorage.setItem('kb_token', token);
    setUser(newUser);
    setLoading(false);
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
      setLoading(false);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
