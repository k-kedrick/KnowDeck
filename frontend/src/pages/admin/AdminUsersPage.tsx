import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff, Plus, Search, Users, X } from 'lucide-react';
import { api, type AdminInvite, type AdminUser, type AdminUserRole, type AdminUserStatus, type User } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Button } from '../../components/ui/Button';

const PAGE_SIZE = 20;
const createFormInitial = () => ({ username: '', password: '', role: 'member' as AdminUserRole });
const passwordFormInitial = () => ({ password: '', confirmPassword: '' });

const createErrorMessage = (message: string) => {
  if (message.includes('用户名已存在')) return '用户名已存在';
  if (message.includes('密码') || message.includes('用户参数无效')) return '密码至少需要 12 个字符';
  if (message.includes('角色')) return '用户角色无效';
  return '创建用户失败，请稍后重试';
};
const mutationErrorMessage = (message: string, kind: 'role' | 'status' | 'password') => {
  if (message.includes('用户不存在')) return '用户不存在';
  if (message.includes('无法')) return '必须至少保留一个可用管理员账户';
  if (kind === 'role' && message.includes('角色')) return '用户角色无效';
  if (kind === 'status' && message.includes('状态')) return '用户状态无效';
  if (kind === 'password' && message.includes('密码')) return '密码至少需要 12 个字符';
  return '操作失败，请稍后重试';
};

export function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<AdminUserRole | ''>('');
  const [status, setStatus] = useState<AdminUserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(createFormInitial);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ user: AdminUser; type: 'disable' | 'demote' } | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetForm, setResetForm] = useState(passwordFormInitial);
  const [resetError, setResetError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showInviteCreate, setShowInviteCreate] = useState(false);
  const [inviteForm, setInviteForm] = useState({ maxUses: 1, expiresAt: '' });
  const [inviteCreating, setInviteCreating] = useState(false);
  const [plaintextInvite, setPlaintextInvite] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [disableInvite, setDisableInvite] = useState<AdminInvite | null>(null);
  const [inviteMutating, setInviteMutating] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setListFailed(false);
    try {
      const data = await api.listAdminUsers({ q: q.trim() || undefined, role: role || undefined, status: status || undefined, page, page_size: PAGE_SIZE });
      setItems(data.items || []);
      setTotal(data.total || 0);
      if (data.total > 0 && page > Math.ceil(data.total / PAGE_SIZE)) setPage(Math.ceil(data.total / PAGE_SIZE));
    } catch {
      setItems([]);
      setTotal(0);
      setListFailed(true);
      setErrorMsg('用户列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, q, role, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => { void api.getMe().then(setCurrentUser).catch(() => setCurrentUser(null)); }, []);

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true); setInviteError(null);
    try { const data = await api.listAdminInvites(); setInvites(data.items || []); }
    catch { setInvites([]); setInviteError('邀请码列表加载失败'); }
    finally { setInvitesLoading(false); }
  }, []);
  useEffect(() => {
    if (activeTab !== 'invites') return;
    const timer = window.setTimeout(() => { void loadInvites(); }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadInvites]);
  useEffect(() => () => setPlaintextInvite(''), []);

  const closeCreateModal = () => { setShowCreateModal(false); setForm(createFormInitial()); setCreateError(null); setShowPassword(false); };
  const closeResetModal = () => { setResetUser(null); setResetForm(passwordFormInitial()); setResetError(null); setShowResetPassword(false); };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password.length < 12) return setCreateError('密码至少需要 12 个字符');
    setCreating(true); setCreateError(null); setSuccessMsg(null);
    try {
      await api.createAdminUser({ username: form.username, password: form.password, role: form.role });
      closeCreateModal(); setSuccessMsg('用户创建成功');
      if (page === 1) void loadUsers(); else setPage(1);
    } catch (error) { setCreateError(createErrorMessage(error instanceof Error ? error.message : '')); } finally { setCreating(false); }
  };

  const runMutation = async (key: string, kind: 'role' | 'status', work: () => Promise<unknown>, message: string) => {
    setMutating(key); setErrorMsg(null); setSuccessMsg(null);
    try { await work(); setConfirmAction(null); setSuccessMsg(message); await loadUsers(); }
    catch (error) { setErrorMsg(mutationErrorMessage(error instanceof Error ? error.message : '', kind)); }
    finally { setMutating(null); }
  };
  const updateRole = (user: AdminUser, nextRole: AdminUserRole) => {
    if (nextRole === 'member' && user.id === currentUser?.id) return;
    if (nextRole === 'member') return setConfirmAction({ user, type: 'demote' });
    void runMutation(`role-${user.id}`, 'role', () => api.updateAdminUserRole(user.id, nextRole), '用户角色已更新');
  };
  const updateStatus = (user: AdminUser, nextStatus: AdminUserStatus) => {
    if (nextStatus === 'disabled' && user.id === currentUser?.id) return;
    if (nextStatus === 'disabled') return setConfirmAction({ user, type: 'disable' });
    void runMutation(`status-${user.id}`, 'status', () => api.updateAdminUserStatus(user.id, nextStatus), '用户已启用');
  };
  const confirmMutation = () => {
    if (!confirmAction) return;
    const { user, type } = confirmAction;
    void runMutation(`${type}-${user.id}`, type === 'demote' ? 'role' : 'status',
      () => type === 'demote' ? api.updateAdminUserRole(user.id, 'member') : api.updateAdminUserStatus(user.id, 'disabled'),
      type === 'demote' ? '用户角色已更新' : '用户已禁用');
  };
  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetUser) return;
    if (resetForm.password.length < 12) return setResetError('密码至少需要 12 个字符');
    if (resetForm.password !== resetForm.confirmPassword) return setResetError('两次输入的密码不一致');
    setMutating(`password-${resetUser.id}`); setResetError(null); setSuccessMsg(null);
    try {
      await api.resetAdminUserPassword(resetUser.id, resetForm.password);
      const resetSelf = resetUser.id === currentUser?.id;
      closeResetModal();
      if (resetSelf) {
        try { await api.logout(); } catch { /* token is intentionally stale */ }
        localStorage.removeItem('kb_token');
        window.location.assign('/wang');
        return;
      }
      setSuccessMsg('密码已重置');
    } catch (error) { setResetError(mutationErrorMessage(error instanceof Error ? error.message : '', 'password')); }
    finally { setMutating(null); }
  };

  const switchTab = (tab: 'users' | 'invites') => {
    setActiveTab(tab); setPlaintextInvite(''); setCopyState('idle');
  };
  const closeInviteResult = () => { setPlaintextInvite(''); setCopyState('idle'); };
  const handleCreateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inviteForm.maxUses < 1 || inviteForm.maxUses > 1000) return setInviteError('最大使用次数无效');
    if (inviteForm.expiresAt && new Date(inviteForm.expiresAt).getTime() <= Date.now()) return setInviteError('过期时间必须晚于当前时间');
    setInviteCreating(true); setInviteError(null);
    try {
      const created = await api.createAdminInvite({ max_uses: inviteForm.maxUses, ...(inviteForm.expiresAt ? { expires_at: new Date(inviteForm.expiresAt).toISOString() } : {}) });
      setShowInviteCreate(false); setInviteForm({ maxUses: 1, expiresAt: '' }); setPlaintextInvite(created.code); setCopyState('idle');
      await loadInvites();
    } catch (error) {
      setInviteError((error instanceof Error && error.message.includes('参数')) ? '邀请码参数无效' : '生成邀请码失败');
    } finally { setInviteCreating(false); }
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(plaintextInvite); setCopyState('copied'); }
    catch { setCopyState('error'); }
  };
  const confirmDisableInvite = async () => {
    if (!disableInvite) return;
    setInviteMutating(disableInvite.id); setInviteError(null);
    try { await api.disableAdminInvite(disableInvite.id); setDisableInvite(null); setSuccessMsg('邀请码已禁用'); await loadInvites(); }
    catch (error) {
      const message = error instanceof Error ? error.message : '';
      setInviteError(message.includes('不存在') ? '邀请码不存在' : message.includes('状态') ? '邀请码已禁用' : '禁用邀请码失败');
    } finally { setInviteMutating(null); }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="mx-auto w-full max-w-[1080px] space-y-6 py-2">
    <AdminPageHeader icon={Users} title="用户管理" description="管理管理员、注册用户和注册邀请码。" actions={activeTab === 'users' ? <Button variant="primary" onClick={() => setShowCreateModal(true)}><Plus className="h-4 w-4" />创建用户</Button> : <Button variant="primary" onClick={() => setShowInviteCreate(true)}><Plus className="h-4 w-4" />生成邀请码</Button>} />
    <div role="tablist" aria-label="用户管理分类" className="flex gap-1 border-b border-border-subtle">
      <button role="tab" aria-selected={activeTab === 'users'} onClick={() => switchTab('users')} className={`border-b-2 px-4 py-2 text-sm font-semibold ${activeTab === 'users' ? 'border-brand text-brand' : 'border-transparent text-text-tertiary'}`}>用户</button>
      <button role="tab" aria-selected={activeTab === 'invites'} onClick={() => switchTab('invites')} className={`border-b-2 px-4 py-2 text-sm font-semibold ${activeTab === 'invites' ? 'border-brand text-brand' : 'border-transparent text-text-tertiary'}`}>邀请码</button>
    </div>
    {errorMsg && <div role="alert" className="flex items-center justify-between gap-3 rounded-ds-md border border-red-200 bg-red-50 p-3 text-sm text-danger"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{errorMsg}</span><Button size="sm" onClick={() => void loadUsers()}>重新加载</Button></div>}
    {successMsg && <div role="status" className="flex items-center gap-2 rounded-ds-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-success"><CheckCircle className="h-4 w-4" />{successMsg}</div>}
    <section className={`${activeTab === 'users' ? '' : 'hidden'} overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm`}>
      <div className="grid gap-3 border-b border-border-subtle p-4 sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:p-5"><label className="relative block"><span className="sr-only">搜索用户名</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-tertiary" /><input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="搜索用户名" className="min-h-10 w-full rounded-lg border border-border-default bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-brand" /></label><select aria-label="角色筛选" value={role} onChange={(event) => { setRole(event.target.value as AdminUserRole | ''); setPage(1); }} className="min-h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand"><option value="">全部角色</option><option value="admin">管理员</option><option value="member">用户</option></select><select aria-label="状态筛选" value={status} onChange={(event) => { setStatus(event.target.value as AdminUserStatus | ''); setPage(1); }} className="min-h-10 w-full rounded-lg border border-border-default bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand"><option value="">全部状态</option><option value="active">正常</option><option value="disabled">已禁用</option></select></div>
      {loading ? <p className="p-8 text-center text-sm text-text-tertiary">加载用户中...</p> : listFailed ? null : items.length === 0 ? <p className="p-8 text-center text-sm text-text-tertiary">暂无用户</p> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-surface-subtle text-text-tertiary"><tr><th className="px-5 py-3 font-medium">用户名</th><th className="px-5 py-3 font-medium">角色</th><th className="px-5 py-3 font-medium">状态</th><th className="px-5 py-3 font-medium">操作</th></tr></thead><tbody>{items.map((user) => { const isSelf = user.id === currentUser?.id; const busy = mutating?.endsWith(`-${user.id}`); return <tr key={user.id} className="border-t border-border-subtle"><td className="px-5 py-3 font-medium text-text-primary">{user.username}</td><td className="px-5 py-3">{user.role === 'admin' ? '管理员' : '用户'}</td><td className="px-5 py-3">{user.status === 'active' ? '正常' : '已禁用'}</td><td className="px-5 py-3"><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!!busy || (isSelf && user.role === 'admin')} title={isSelf && user.role === 'admin' ? '不能降低当前登录账户的管理员权限' : undefined} onClick={() => updateRole(user, user.role === 'admin' ? 'member' : 'admin')}>{user.role === 'admin' ? '设为普通用户' : '设为管理员'}</Button><Button size="sm" disabled={!!busy || (isSelf && user.status === 'active')} title={isSelf && user.status === 'active' ? '不能禁用当前登录账户' : undefined} onClick={() => updateStatus(user, user.status === 'active' ? 'disabled' : 'active')}>{user.status === 'active' ? '禁用' : '启用'}</Button><Button size="sm" disabled={!!busy} onClick={() => { setResetUser(user); setResetError(null); }}>重置密码</Button></div></td></tr>; })}</tbody></table></div>}
      {!loading && !listFailed && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-4 text-sm"><span className="text-text-tertiary">共 {total} 个用户 · 第 {page} / {totalPages} 页</span><div className="flex gap-2"><Button size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</Button><Button size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</Button></div></div>}
    </section>
    {activeTab === 'invites' && <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
      {inviteError && <div role="alert" className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 p-3 text-sm text-danger"><span>{inviteError}</span><Button size="sm" onClick={() => void loadInvites()}>重新加载邀请码</Button></div>}
      {invitesLoading ? <p className="p-8 text-center text-sm text-text-tertiary">加载邀请码中...</p> : inviteError ? null : invites.length === 0 ? <p className="p-8 text-center text-sm text-text-tertiary">暂无邀请码</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-subtle text-text-tertiary"><tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">状态</th><th className="px-5 py-3">使用次数</th><th className="px-5 py-3">过期时间</th><th className="px-5 py-3">操作</th></tr></thead><tbody>{invites.map((invite) => <tr key={invite.id} className="border-t border-border-subtle"><td className="px-5 py-3">{invite.id}</td><td className="px-5 py-3">{invite.status === 'active' ? '可用' : invite.status === 'disabled' ? '已禁用' : invite.status}</td><td className="px-5 py-3">{invite.used_count} / {invite.max_uses ?? '不限'}</td><td className="px-5 py-3">{invite.expires_at ? new Date(invite.expires_at).toLocaleString() : '永久有效'}</td><td className="px-5 py-3">{invite.status === 'active' ? <Button size="sm" disabled={inviteMutating === invite.id} onClick={() => setDisableInvite(invite)}>禁用</Button> : <span className="text-text-tertiary">已禁用</span>}</td></tr>)}</tbody></table></div>}
    </section>}
    {showCreateModal && <Modal title="创建用户" onClose={closeCreateModal}><form onSubmit={handleCreate} className="space-y-4">{createError && <p role="alert" className="text-sm text-danger">{createError}</p>}<Field label="用户名"><input aria-label="用户名" required value={form.username} onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))} className="input" /></Field><PasswordField value={form.password} onChange={(password) => setForm((value) => ({ ...value, password }))} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} /><Field label="角色"><select aria-label="创建用户角色" value={form.role} onChange={(event) => setForm((value) => ({ ...value, role: event.target.value as AdminUserRole }))} className="input"><option value="member">普通用户</option><option value="admin">管理员</option></select></Field><ModalActions onClose={closeCreateModal} disabled={creating} submitText={creating ? '创建中...' : '创建用户'} /></form></Modal>}
    {confirmAction && <Modal title={confirmAction.type === 'disable' ? '确认禁用用户' : '确认修改角色'} onClose={() => setConfirmAction(null)}><p className="text-sm text-text-secondary">{confirmAction.type === 'disable' ? `禁用后「${confirmAction.user.username}」当前登录状态将立即失效，确定继续吗？` : `确定要将管理员「${confirmAction.user.username}」调整为普通用户吗？`}</p><ModalActions onClose={() => setConfirmAction(null)} disabled={!!mutating} onSubmit={confirmMutation} submitText={mutating ? '处理中...' : '确认执行'} /></Modal>}
    {resetUser && <Modal title={`重置「${resetUser.username}」的密码`} onClose={closeResetModal}><form onSubmit={handleResetPassword} className="space-y-4">{resetError && <p role="alert" className="text-sm text-danger">{resetError}</p>}{resetUser.id === currentUser?.id && <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">重置当前账户密码后，需要重新登录。</p>}<PasswordField value={resetForm.password} onChange={(password) => setResetForm((value) => ({ ...value, password }))} visible={showResetPassword} onToggle={() => setShowResetPassword((value) => !value)} label="新密码" /><Field label="确认新密码"><input aria-label="确认新密码" required type={showResetPassword ? 'text' : 'password'} value={resetForm.confirmPassword} onChange={(event) => setResetForm((value) => ({ ...value, confirmPassword: event.target.value }))} className="input" /></Field><ModalActions onClose={closeResetModal} disabled={!!mutating} submitText={mutating ? '重置中...' : '重置密码'} /></form></Modal>}
    {showInviteCreate && <Modal title="生成邀请码" onClose={() => { setShowInviteCreate(false); setInviteForm({ maxUses: 1, expiresAt: '' }); }}><form onSubmit={handleCreateInvite} className="space-y-4"><Field label="最大使用次数"><input aria-label="最大使用次数" type="number" min={1} max={1000} value={inviteForm.maxUses} onChange={(event) => setInviteForm((value) => ({ ...value, maxUses: Number(event.target.value) }))} className="input" /></Field><Field label="过期时间"><input aria-label="过期时间" type="datetime-local" value={inviteForm.expiresAt} onChange={(event) => setInviteForm((value) => ({ ...value, expiresAt: event.target.value }))} className="input" /></Field><ModalActions onClose={() => { setShowInviteCreate(false); setInviteForm({ maxUses: 1, expiresAt: '' }); }} disabled={inviteCreating} submitText={inviteCreating ? '生成中...' : '生成邀请码'} /></form></Modal>}
    {plaintextInvite && <Modal title="邀请码已生成" onClose={closeInviteResult}><p className="text-sm text-text-secondary">请立即复制保存。关闭后将无法再次查看完整邀请码。</p><code className="block break-all rounded-lg bg-surface-subtle p-4 font-mono text-sm text-text-primary">{plaintextInvite}</code>{copyState === 'error' && <p role="alert" className="text-sm text-danger">复制失败，请手动复制</p>}<div className="flex justify-end gap-2"><Button onClick={closeInviteResult}>关闭</Button><Button variant="primary" onClick={() => void copyInvite()}>{copyState === 'copied' ? '已复制' : '复制邀请码'}</Button></div></Modal>}
    {disableInvite && <Modal title="确认禁用邀请码" onClose={() => setDisableInvite(null)}><p className="text-sm text-text-secondary">禁用后该邀请码将无法继续注册，确定继续吗？</p><ModalActions onClose={() => setDisableInvite(null)} disabled={inviteMutating === disableInvite.id} onSubmit={() => void confirmDisableInvite()} submitText={inviteMutating === disableInvite.id ? '禁用中...' : '确认禁用'} /></Modal>}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-text-primary">{label}<span className="mt-1.5 block">{children}</span></label>; }
function PasswordField({ value, onChange, visible, onToggle, label = '密码' }: { value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; label?: string }) { return <Field label={label}><span className="relative block"><input aria-label={label} required type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} className="input pr-10" /><button type="button" aria-label={visible ? '隐藏密码' : '显示密码'} onClick={onToggle} className="absolute inset-y-0 right-0 px-3 text-text-tertiary">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span><span className="mt-1 block text-xs font-normal text-text-tertiary">至少 12 个字符。</span></Field>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md space-y-4 rounded-ds-lg border border-border-default bg-surface-elevated p-5 shadow-modal"><div className="flex items-center justify-between border-b border-border-subtle pb-3"><h2 className="text-base font-semibold text-text-primary">{title}</h2><button type="button" aria-label={title === '创建用户' ? '关闭创建用户' : '关闭对话框'} onClick={onClose} className="p-1 text-text-tertiary hover:text-text-primary"><X className="h-4 w-4" /></button></div>{children}</div></div>; }
function ModalActions({ onClose, disabled, submitText, onSubmit }: { onClose: () => void; disabled: boolean; submitText: string; onSubmit?: () => void }) { return <div className="flex justify-end gap-2 border-t border-border-subtle pt-4"><Button onClick={onClose} disabled={disabled}>取消</Button><Button type={onSubmit ? 'button' : 'submit'} variant="primary" disabled={disabled} onClick={onSubmit}>{submitText}</Button></div>; }
