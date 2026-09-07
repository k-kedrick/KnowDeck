import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  listAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  getMe: vi.fn(),
  updateAdminUserRole: vi.fn(),
  updateAdminUserStatus: vi.fn(),
  resetAdminUserPassword: vi.fn(),
  logout: vi.fn(),
  listAdminInvites: vi.fn(),
  createAdminInvite: vi.fn(),
  disableAdminInvite: vi.fn(),
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

import { AdminUsersPage } from './AdminUsersPage';

const user = { id: 2, username: 'member-one', role: 'member' as const, status: 'active' as const, created_at: '2026-09-07', updated_at: '2026-09-07' };
const page = (items: Array<typeof user | { id: number; username: string; role: 'admin' | 'member'; status: 'active' | 'disabled'; created_at: string; updated_at: string }> = [user], total = items.length, currentPage = 1) => ({ items, total, page: currentPage, page_size: 20 });

describe('AdminUsersPage', () => {
  beforeEach(() => {
    apiMocks.listAdminUsers.mockReset().mockResolvedValue(page());
    apiMocks.createAdminUser.mockReset().mockResolvedValue({ id: 3, username: 'new-user', role: 'member', status: 'active' });
    apiMocks.getMe.mockReset().mockResolvedValue({ id: 1, username: 'admin', role: 'admin' });
    apiMocks.updateAdminUserRole.mockReset().mockResolvedValue({ id: 2, role: 'admin' });
    apiMocks.updateAdminUserStatus.mockReset().mockResolvedValue({ id: 2, status: 'disabled' });
    apiMocks.resetAdminUserPassword.mockReset().mockResolvedValue({ id: 2 });
    apiMocks.listAdminInvites.mockReset().mockResolvedValue({ items: [] });
    apiMocks.createAdminInvite.mockReset().mockResolvedValue({ id: 11, code: 'WXK-ONE-TIME-CODE', status: 'active', max_uses: 1, used_count: 0, expires_at: null });
    apiMocks.disableAdminInvite.mockReset().mockResolvedValue({ id: 11, status: 'disabled' });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(cleanup);

  it('renders loading then a backend user list through the existing API client', async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    apiMocks.listAdminUsers.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<AdminUsersPage />);
    expect(screen.getByText('加载用户中...')).toBeTruthy();
    resolve(page());
    expect(await screen.findByText('member-one')).toBeTruthy();
    expect(apiMocks.listAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 20 }));
  });

  it('shows empty and API error states distinctly', async () => {
    apiMocks.listAdminUsers.mockResolvedValueOnce(page([], 0));
    const { unmount } = render(<AdminUsersPage />);
    expect(await screen.findByText('暂无用户')).toBeTruthy();
    unmount();
    apiMocks.listAdminUsers.mockRejectedValueOnce(new Error('offline'));
    render(<AdminUsersPage />);
    expect(await screen.findByText('用户列表加载失败')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeTruthy();
  });

  it('sends backend search, filters, and pagination parameters', async () => {
    apiMocks.listAdminUsers.mockResolvedValue(page([user], 41));
    render(<AdminUsersPage />);
    await screen.findByText('member-one');
    fireEvent.change(screen.getByPlaceholderText('搜索用户名'), { target: { value: 'wang' } });
    await waitFor(() => expect(apiMocks.listAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'wang', page: 1 })));
    fireEvent.change(screen.getByLabelText('角色筛选'), { target: { value: 'admin' } });
    await waitFor(() => expect(apiMocks.listAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'admin', page: 1 })));
    fireEvent.change(screen.getByLabelText('状态筛选'), { target: { value: 'disabled' } });
    await waitFor(() => expect(apiMocks.listAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'disabled', page: 1 })));
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(apiMocks.listAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.click(screen.getByRole('button', { name: '上一页' }));
    await waitFor(() => expect(apiMocks.listAdminUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
  });

  it('creates a member, refreshes the list, and clears password when closed', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('member-one');
    fireEvent.click(screen.getByRole('button', { name: '创建用户' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('创建用户角色') as HTMLSelectElement).value).toBe('member');
    const password = screen.getByLabelText('密码') as HTMLInputElement;
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'created-user' } });
    fireEvent.change(password, { target: { value: '123456789012' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^创建用户$/ }).at(-1)!);
    await waitFor(() => expect(apiMocks.createAdminUser).toHaveBeenCalledWith({ username: 'created-user', password: '123456789012', role: 'member' }));
    expect(await screen.findByText('用户创建成功')).toBeTruthy();
    expect(apiMocks.listAdminUsers.mock.calls.length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: '创建用户' }));
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: '关闭创建用户' }));
    fireEvent.click(screen.getByRole('button', { name: '创建用户' }));
    expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('');
  });

  it('shows local weak-password and mapped username errors', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('member-one');
    fireEvent.click(screen.getByRole('button', { name: '创建用户' }));
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'duplicate-user' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'short' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^创建用户$/ }).at(-1)!);
    expect(await screen.findByText('密码至少需要 12 个字符')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('密码'), { target: { value: '123456789012' } });
    apiMocks.createAdminUser.mockRejectedValueOnce(new Error('用户名已存在'));
    fireEvent.click(screen.getAllByRole('button', { name: /^创建用户$/ }).at(-1)!);
    expect(await screen.findByText('用户名已存在')).toBeTruthy();
  });

  it('updates member role immediately and confirms admin demotion before the API call', async () => {
    const admin = { ...user, id: 3, username: 'admin-two', role: 'admin' as const };
    apiMocks.listAdminUsers.mockResolvedValue(page([user, admin], 2));
    render(<AdminUsersPage />);
    await screen.findByText('admin-two');
    fireEvent.click(screen.getByRole('button', { name: '设为管理员' }));
    await waitFor(() => expect(apiMocks.updateAdminUserRole).toHaveBeenCalledWith(2, 'admin'));
    expect(apiMocks.listAdminUsers.mock.calls.length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: '设为普通用户' }));
    expect(screen.getByRole('dialog', { name: '确认修改角色' })).toBeTruthy();
    expect(apiMocks.updateAdminUserRole).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
    await waitFor(() => expect(apiMocks.updateAdminUserRole).toHaveBeenCalledWith(3, 'member'));
  });

  it('confirms disable, enables disabled users, and keeps current admin protections disabled', async () => {
    const self = { ...user, id: 1, username: 'admin', role: 'admin' as const };
    const disabled = { ...user, id: 3, username: 'disabled-user', status: 'disabled' as const };
    apiMocks.listAdminUsers.mockResolvedValue(page([self, user, disabled], 3));
    render(<AdminUsersPage />);
    await screen.findByText('disabled-user');
    const selfRow = screen.getByText('admin').closest('tr')!;
    expect((selfRow.querySelectorAll('button')[0] as HTMLButtonElement).disabled).toBe(true);
    expect((selfRow.querySelectorAll('button')[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('member-one').closest('tr')!.querySelectorAll('button')[1]);
    expect(screen.getByRole('dialog', { name: '确认禁用用户' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
    await waitFor(() => expect(apiMocks.updateAdminUserStatus).toHaveBeenCalledWith(2, 'disabled'));
    fireEvent.click(screen.getByText('disabled-user').closest('tr')!.querySelectorAll('button')[1]);
    await waitFor(() => expect(apiMocks.updateAdminUserStatus).toHaveBeenCalledWith(3, 'active'));
  });

  it('maps last-admin errors and validates/resets passwords without affecting another user session', async () => {
    apiMocks.updateAdminUserStatus.mockRejectedValueOnce(new Error('无法禁用用户'));
    render(<AdminUsersPage />);
    await screen.findByText('member-one');
    fireEvent.click(screen.getByRole('button', { name: '禁用' }));
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
    expect(await screen.findByText('必须至少保留一个可用管理员账户')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    fireEvent.click(screen.getByRole('button', { name: '重置密码' }));
    expect(screen.getByRole('dialog', { name: '重置「member-one」的密码' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'different' } });
    fireEvent.click(screen.getAllByRole('button', { name: '重置密码' }).at(-1)!);
    expect(await screen.findByText('密码至少需要 12 个字符')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: '123456789012' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: '123456789012' } });
    fireEvent.click(screen.getAllByRole('button', { name: '重置密码' }).at(-1)!);
    await waitFor(() => expect(apiMocks.resetAdminUserPassword).toHaveBeenCalledWith(2, '123456789012'));
    expect(apiMocks.logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重置密码' }));
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: '关闭对话框' }));
    fireEvent.click(screen.getByRole('button', { name: '重置密码' }));
    expect((screen.getByLabelText('新密码') as HTMLInputElement).value).toBe('');
  });

  it('loads invite tab with empty, error, and safe historical list states', async () => {
    const invite = { id: 11, created_by: 1, status: 'active', max_uses: 2, used_count: 1, expires_at: null };
    let resolveInvites!: (value: { items: Array<typeof invite> }) => void;
    apiMocks.listAdminInvites.mockReturnValueOnce(new Promise((resolve) => { resolveInvites = resolve; })).mockResolvedValueOnce({ items: [invite] });
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('tab', { name: '邀请码' }));
    expect(await screen.findByText('加载邀请码中...')).toBeTruthy();
    await act(async () => resolveInvites({ items: [] }));
    expect(await screen.findByText('暂无邀请码')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '用户' }));
    fireEvent.click(screen.getByRole('tab', { name: '邀请码' }));
    expect(await screen.findByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('永久有效')).toBeTruthy();
    expect(screen.queryByText(/code_hash/i)).toBeNull();
    expect(screen.queryByText('WXK-ONE-TIME-CODE')).toBeNull();

    apiMocks.listAdminInvites.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('tab', { name: '用户' }));
    fireEvent.click(screen.getByRole('tab', { name: '邀请码' }));
    expect(await screen.findByText('邀请码列表加载失败')).toBeTruthy();
  });

  it('creates, copies, and destroys the one-time plaintext invite', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('tab', { name: '邀请码' }));
    await screen.findByText('暂无邀请码');
    fireEvent.click(screen.getByRole('button', { name: '生成邀请码' }));
    expect((screen.getByLabelText('最大使用次数') as HTMLInputElement).value).toBe('1');
    fireEvent.change(screen.getByLabelText('最大使用次数'), { target: { value: '3' } });
    fireEvent.click(screen.getAllByRole('button', { name: '生成邀请码' }).at(-1)!);
    await waitFor(() => expect(apiMocks.createAdminInvite).toHaveBeenCalledWith({ max_uses: 3 }));
    expect(await screen.findByText('WXK-ONE-TIME-CODE')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '复制邀请码' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('WXK-ONE-TIME-CODE'));
    expect(await screen.findByRole('button', { name: '已复制' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByText('WXK-ONE-TIME-CODE')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '生成邀请码' }));
    expect(screen.queryByText('WXK-ONE-TIME-CODE')).toBeNull();
  });

  it('confirms disabling active invites and leaves disabled invites non-actionable', async () => {
    const active = { id: 11, created_by: 1, status: 'active', max_uses: 1, used_count: 0, expires_at: null };
    const disabled = { ...active, id: 12, status: 'disabled' };
    apiMocks.listAdminInvites.mockResolvedValue({ items: [active, disabled] });
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('tab', { name: '邀请码' }));
    await screen.findAllByText('永久有效');
    expect(screen.getAllByText('已禁用').length).toBeGreaterThanOrEqual(2);
    const activeInviteRow = screen.getByText('11').closest('tr')!;
    expect(activeInviteRow.querySelectorAll('button')).toHaveLength(1);
    fireEvent.click(activeInviteRow.querySelector('button')!);
    expect(screen.getByRole('dialog', { name: '确认禁用邀请码' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认禁用' }));
    await waitFor(() => expect(apiMocks.disableAdminInvite).toHaveBeenCalledWith(11));
    expect(await screen.findByText('邀请码已禁用')).toBeTruthy();
  });
});
