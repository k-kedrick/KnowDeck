import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../api';

const apiMocks = vi.hoisted(() => ({
  memberMe: vi.fn(),
  memberChangePassword: vi.fn(),
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

const Harness = () => {
  const { user, loading, changePassword } = useAuth();
  if (loading) return <span>加载中</span>;
  return (
    <button type="button" onClick={() => changePassword('current-password', 'new-password-123')}>
      {user?.username || '未登录'}
    </button>
  );
};

describe('AuthProvider password change', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('kb_token', 'old-token');
    apiMocks.memberMe.mockReset().mockResolvedValue(member);
    apiMocks.memberChangePassword.mockReset().mockResolvedValue({ token: 'fresh-token', user: member });
  });
  afterEach(cleanup);

  it('replaces the old token with the renewed token', async () => {
    render(<AuthProvider><Harness /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'member1' }));

    await waitFor(() => expect(apiMocks.memberChangePassword).toHaveBeenCalledWith('current-password', 'new-password-123'));
    expect(localStorage.getItem('kb_token')).toBe('fresh-token');
  });
});
