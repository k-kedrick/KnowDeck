import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { User } from '../../api';
import { ApiError } from '../../api';

const authMock = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

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

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: member,
    loading: false,
    changePassword: authMock.changePassword,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { AccountSecurityPage } from './AccountSecurityPage';

const renderPage = () => render(
  <MemoryRouter initialEntries={['/account/security']}>
    <Routes>
      <Route element={<Outlet context={{ siteInfo: null }} />}>
        <Route path="/account/security" element={<AccountSecurityPage />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('AccountSecurityPage', () => {
  beforeEach(() => authMock.changePassword.mockReset().mockResolvedValue(undefined));
  afterEach(cleanup);

  it('validates confirmation before submitting', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'current-password' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new-password-123' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: '保存新密码' }));

    expect(screen.getByRole('alert').textContent).toContain('两次输入的新密码不一致');
    expect(authMock.changePassword).not.toHaveBeenCalled();
  });

  it('submits the password change and shows the renewed-session result', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'current-password' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new-password-123' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'new-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: '保存新密码' }));

    await waitFor(() => expect(authMock.changePassword).toHaveBeenCalledWith('current-password', 'new-password-123'));
    expect((await screen.findByRole('status')).textContent).toContain('密码已修改');
    expect((screen.getByLabelText('当前密码') as HTMLInputElement).value).toBe('');
  });

  it('explains a missing backend route instead of showing HTTP 404', async () => {
    authMock.changePassword.mockRejectedValueOnce(new ApiError('请求的服务接口不存在', 404));
    renderPage();
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'current-password' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'new-password-123' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'new-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: '保存新密码' }));

    expect((await screen.findByRole('alert')).textContent).toContain('修改密码服务尚未生效，请重启后端服务后重试');
  });
});
