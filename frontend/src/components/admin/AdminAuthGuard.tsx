import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '../../api';
import type { User } from '../../api';

export const AdminAuthGuard: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('kb_token');
      if (!token) {
        setLoading(false);
        setAuthenticated(false);
        return;
      }

      try {
        const user = await api.getMe();
        setCurrentUser(user);
        setAuthenticated(true);
      } catch (err) {
        console.warn('Authentication token invalid or expired:', err);
        localStorage.removeItem('kb_token');
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400">
          <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="font-medium text-sm">正在验证管理员权限...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/wang/login" replace />;
  }

  return <Outlet context={{ user: currentUser }} />;
};
