import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { UserDropdown } from './UserDropdown';
import type { User } from '../api';

const mockAdminUser: User = {
  id: 1,
  username: 'admin',
  nickname: '站长大大',
  avatar: '',
  email: 'admin@example.com',
  role: 'admin',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const mockMemberUser: User = {
  id: 2,
  username: 'member1',
  nickname: '成员小白',
  avatar: '',
  email: 'member1@example.com',
  role: 'member',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('UserDropdown component', () => {
  afterEach(cleanup);

  it('renders user trigger with display name and opens dropdown on click', () => {
    const onLogout = vi.fn();
    const onToggleDarkMode = vi.fn();

    render(
      <MemoryRouter>
        <UserDropdown
          user={mockAdminUser}
          onLogout={onLogout}
          darkMode={false}
          onToggleDarkMode={onToggleDarkMode}
        />
      </MemoryRouter>
    );

    const triggerBtn = screen.getByRole('button', { name: '打开用户菜单' });
    expect(triggerBtn).toBeTruthy();
    expect(screen.getByText('站长大大')).toBeTruthy();

    // Dropdown is initially closed
    expect(screen.queryByRole('menu')).toBeNull();

    // Click to open
    fireEvent.click(triggerBtn);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByText('管理员')).toBeTruthy();
    expect(screen.getByText('@admin')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '进入管理控制台' })).toBeTruthy();
    expect(screen.getByText('切换为暗色模式')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '退出登录' })).toBeTruthy();
  });

  it('does not show admin console link for member role', () => {
    render(
      <MemoryRouter>
        <UserDropdown
          user={mockMemberUser}
          onLogout={vi.fn()}
          darkMode={true}
          onToggleDarkMode={vi.fn()}
        />
      </MemoryRouter>
    );

    const triggerBtn = screen.getByRole('button', { name: '打开用户菜单' });
    fireEvent.click(triggerBtn);

    expect(screen.getAllByText('成员小白').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('成员')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: '进入管理控制台' })).toBeNull();
    expect(screen.getByText('切换为亮色模式')).toBeTruthy();
  });

  it('triggers logout callback and closes on Escape', () => {
    const onLogout = vi.fn();

    render(
      <MemoryRouter>
        <UserDropdown
          user={mockAdminUser}
          onLogout={onLogout}
          darkMode={false}
          onToggleDarkMode={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '打开用户菜单' }));
    const logoutBtn = screen.getByRole('menuitem', { name: '退出登录' });
    fireEvent.click(logoutBtn);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
