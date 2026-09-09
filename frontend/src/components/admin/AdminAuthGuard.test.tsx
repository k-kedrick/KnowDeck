import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom';
import { AuthContext } from '../../auth/useAuth';
import type { AuthState } from '../../auth/useAuth';
import { AdminAuthGuard } from './AdminAuthGuard';
import type { User } from '../../api';

const adminUser: User = {
  id: 1,
  username: 'admin',
  nickname: '管理员',
  avatar: '',
  email: '',
  role: 'admin',
  created_at: '',
  updated_at: '',
};

const memberUser: User = {
  id: 2,
  username: 'member1',
  nickname: '成员一',
  avatar: '',
  email: '',
  role: 'member',
  created_at: '',
  updated_at: '',
};

const ProtectedChild = () => {
  const { user } = useOutletContext<{ user: User }>();
  return <div>后台已放行: {user?.username} ({user?.role})</div>;
};

const renderGuard = (authState: Partial<AuthState>) => {
  const fullState: AuthState = {
    user: null,
    loading: false,
    login: async () => {},
    adminLogin: async () => {},
    changePassword: async () => {},
    logout: () => {},
    setSession: () => {},
    ...authState,
  };

  return render(
    <AuthContext.Provider value={fullState}>
      <MemoryRouter initialEntries={['/wang']}>
        <Routes>
          <Route path="/wang/login" element={<div>管理员登录页面</div>} />
          <Route path="/wang" element={<AdminAuthGuard />}>
            <Route index element={<ProtectedChild />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe('AdminAuthGuard', () => {
  afterEach(cleanup);

  it('renders loading state while checking authentication', () => {
    renderGuard({ loading: true });
    expect(screen.getByText('正在验证管理员权限...')).toBeTruthy();
  });

  it('redirects to /wang/login when user is not authenticated', () => {
    renderGuard({ user: null, loading: false });
    expect(screen.getByText('管理员登录页面')).toBeTruthy();
  });

  it('redirects to /wang/login when authenticated user is only a member', () => {
    renderGuard({ user: memberUser, loading: false });
    expect(screen.getByText('管理员登录页面')).toBeTruthy();
    expect(screen.queryByText(/后台已放行/)).toBeNull();
  });

  it('renders child routes and passes user context when user is an admin', () => {
    renderGuard({ user: adminUser, loading: false });
    expect(screen.getByText('后台已放行: admin (admin)')).toBeTruthy();
  });
});
