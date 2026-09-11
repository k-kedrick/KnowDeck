import { Search } from 'lucide-react';
import type { AdminUser, AdminUserRole, AdminUserStatus, User } from '../../../api';
import { Button } from '../../../components/ui/Button';

interface UsersTabProps {
  currentUser: User | null;
  items: AdminUser[];
  listFailed: boolean;
  loading: boolean;
  mutating: string | null;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onResetPassword: (user: AdminUser) => void;
  onRoleChange: (value: AdminUserRole | '') => void;
  onStatusChange: (value: AdminUserStatus | '') => void;
  onUpdateRole: (user: AdminUser, role: AdminUserRole) => void;
  onUpdateStatus: (user: AdminUser, status: AdminUserStatus) => void;
  page: number;
  query: string;
  role: AdminUserRole | '';
  status: AdminUserStatus | '';
  total: number;
  totalPages: number;
}

export function UsersTab({
  currentUser, items, listFailed, loading, mutating, onPageChange, onQueryChange,
  onResetPassword, onRoleChange, onStatusChange, onUpdateRole, onUpdateStatus,
  page, query, role, status, total, totalPages,
}: UsersTabProps) {
  return (<section className="admin-table-shell">
          {/* Filters */}
          <div className="admin-toolbar grid gap-3 px-4 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
            <label className="relative block">
              <span className="sr-only">搜索用户名</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" />
              <input
                value={query}
                onChange={(event) => {
                  onQueryChange(event.target.value);
                }}
                placeholder="搜索用户名"
                className="min-h-10 w-full rounded-lg border border-border-default bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-brand"
              />
            </label>
            <select
              aria-label="角色筛选"
              value={role}
              onChange={(event) => {
                onRoleChange(event.target.value as AdminUserRole | '');
              }}
              className="min-h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">全部角色</option>
              <option value="admin">管理员</option>
              <option value="member">普通用户</option>
            </select>
            <select
              aria-label="状态筛选"
              value={status}
              onChange={(event) => {
                onStatusChange(event.target.value as AdminUserStatus | '');
              }}
              className="min-h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="disabled">已禁用</option>
            </select>
          </div>

          {/* User Table */}
          {loading ? (
            <p className="p-8 text-center text-sm text-text-tertiary">加载用户中...</p>
          ) : listFailed ? null : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-tertiary">暂无用户</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-surface-subtle text-text-tertiary">
                  <tr>
                    <th className="px-5 py-3 font-medium">用户名</th>
                    <th className="px-5 py-3 font-medium">角色</th>
                    <th className="px-5 py-3 font-medium">状态</th>
                    <th className="px-5 py-3 font-medium">注册时间</th>
                    <th className="px-5 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {items.map((user) => {
                    const isSelf = user.id === currentUser?.id;
                    const busy = mutating?.endsWith(`-${user.id}`);
                    return (
                      <tr key={user.id} className="transition-colors hover:bg-surface-subtle/50">
                        <td className="px-5 py-3 font-medium text-text-primary">
                          <div className="flex items-center gap-2">
                            <span>{user.username}</span>
                            {isSelf && (
                              <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                                当前登录
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.role === 'admin'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {user.role === 'admin' ? '管理员' : '普通用户'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {user.status === 'active' ? '正常' : '已禁用'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-text-tertiary">
                          {user.created_at ? new Date(user.created_at).toLocaleString() : '-'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"

                              disabled={!!busy || (isSelf && user.role === 'admin')}
                              title={isSelf && user.role === 'admin' ? '不能降低当前登录账户的管理员权限' : undefined}
                              onClick={() => onUpdateRole(user, user.role === 'admin' ? 'member' : 'admin')}
                            >
                              {user.role === 'admin' ? '降为用户' : '设为管理员'}
                            </Button>
                            <Button
                              size="sm"

                              disabled={!!busy || (isSelf && user.status === 'active')}
                              title={isSelf && user.status === 'active' ? '不能禁用当前登录账户' : undefined}
                              onClick={() => onUpdateStatus(user, user.status === 'active' ? 'disabled' : 'active')}
                            >
                              {user.status === 'active' ? '禁用' : '启用'}
                            </Button>
                            <Button
                              size="sm"

                              disabled={!!busy}
                              onClick={() => {
                                onResetPassword(user);
                              }}
                            >
                              重置密码
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !listFailed && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3.5 text-sm">
              <span className="text-text-tertiary">
                共 {total} 个用户 · 第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                  上一页
                </Button>
                <Button size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </section>  );
}