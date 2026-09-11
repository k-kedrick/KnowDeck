import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../api';

const apiMocks = vi.hoisted(() => ({
  memberMe: vi.fn(),
  memberChangePassword: vi.fn(),
  login: vi.fn(),
}));

vi.mock('../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const member: User = {
  id: 2,
  username: 'member1',
  nickname: '成员一',
  avatar: '',
  email: '',
  role: 'member',
  created_at: '',
  updated_at: '',
};

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

const Harness = () => {
  const { user, loading, changePassword, adminLogin } = useAuth();
  if (loading) return <span>加载中</span>;
  return (
    <div>
      <button type="button" onClick={() => changePassword('current-password', 'new-password-123')}>
        {user?.username || '未登录'}
      </button>
      <button type="button" onClick={() => adminLogin('admin', 'admin-pass-123')}>
        登录管理员
      </button>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kb_token', 'old-token');
    apiMocks.memberMe.mockReset().mockResolvedValue(member);
    apiMocks.memberChangePassword.mockReset().mockResolvedValue({ token: 'fresh-token', user: member });
    apiMocks.login.mockReset().mockResolvedValue({ token: 'admin-jwt-token', user: adminUser });
  });
  afterEach(cleanup);

  it('replaces the old token with the renewed token on password change', async () => {
    render(<AuthProvider><Harness /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'member1' }));

    await waitFor(() => expect(apiMocks.memberChangePassword).toHaveBeenCalledWith('current-password', 'new-password-123'));
    expect(localStorage.getItem('kb_token')).toBe('fresh-token');
  });

  it('logs in admin and sets session properly', async () => {
    localStorage.clear();
    render(<AuthProvider><Harness /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: '登录管理员' }));

    await waitFor(() => expect(apiMocks.login).toHaveBeenCalledWith('admin', 'admin-pass-123'));
    expect(localStorage.getItem('kb_token')).toBe('admin-jwt-token');
    expect(screen.getByRole('button', { name: 'admin' })).toBeTruthy();
  });

  it('is ready immediately when no stored session exists', () => {
    localStorage.clear();
    render(<AuthProvider><Harness /></AuthProvider>);

    expect(screen.getByRole('button', { name: '未登录' })).toBeTruthy();
    expect(apiMocks.memberMe).not.toHaveBeenCalled();
  });

  it('does not let a stale initial session request overwrite a newer login', async () => {
    let resolveInitialSession!: (user: User) => void;
    apiMocks.memberMe.mockReturnValue(new Promise<User>((resolve) => { resolveInitialSession = resolve; }));
    const LoginHarness = () => {
      const { user, adminLogin } = useAuth();
      return <button type="button" onClick={() => adminLogin('admin', 'admin-pass-123')}>{user?.username || '登录'}</button>;
    };

    render(<AuthProvider><LoginHarness /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    expect(await screen.findByRole('button', { name: 'admin' })).toBeTruthy();

    await act(async () => resolveInitialSession(member));
    expect(screen.getByRole('button', { name: 'admin' })).toBeTruthy();
  });
});
