import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Plus,
  Search,
  Users,
  X,
  Copy,
  Check,
  Edit2,
  Trash2,
  Key,
  RefreshCw,
  UserCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  api,
  type AdminInvite,
  type AdminInviteUserUsage,
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
  type User,
} from '../../api';
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

const VALID_DAYS_PRESETS = [
  { label: '永久有效', days: 0 },
  { label: '1 天', days: 1 },
  { label: '7 天', days: 7 },
  { label: '30 天', days: 30 },
  { label: '90 天', days: 90 },
  { label: '365 天', days: 365 },
  { label: '自定义', days: -1 },
];

export function AdminUsersPage() {
  // Users tab state
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

  // User modal state
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

  // Tabs & Invites tab state
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteStatusFilter, setInviteStatusFilter] = useState<string>('');

  // Selected invites for batch actions
  const [selectedInviteIds, setSelectedInviteIds] = useState<number[]>([]);

  // Generate Invite Modal state
  const [showInviteCreate, setShowInviteCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'random' | 'custom'>('random');
  const [inviteCount, setInviteCount] = useState<number>(1);
  const [customCode, setCustomCode] = useState<string>('');
  const [validDaysPreset, setValidDaysPreset] = useState<number>(0);
  const [customValidDays, setCustomValidDays] = useState<string>('');
  const [inviteMaxUses, setInviteMaxUses] = useState<number>(1);
  const [inviteRemark, setInviteRemark] = useState<string>('');
  const [inviteCreating, setInviteCreating] = useState(false);

  // Generated results drawer / modal
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [batchCopied, setBatchCopied] = useState(false);

  // Edit Invite Modal state
  const [editInvite, setEditInvite] = useState<AdminInvite | null>(null);
  const [editRemark, setEditRemark] = useState('');
  const [editMaxUses, setEditMaxUses] = useState<number>(1);
  const [editValidDaysMode, setEditValidDaysMode] = useState<'keep' | 'preset' | 'custom'>('keep');
  const [editValidDays, setEditValidDays] = useState<number>(0);
  const [editUpdating, setEditUpdating] = useState(false);

  // View Invite Users Modal
  const [viewUsersInvite, setViewUsersInvite] = useState<AdminInvite | null>(null);
  const [inviteUsersList, setInviteUsersList] = useState<AdminInviteUserUsage[]>([]);
  const [inviteUsersLoading, setInviteUsersLoading] = useState(false);

  // Single & Batch Delete / Status confirmations
  const [deleteTargetInvite, setDeleteTargetInvite] = useState<AdminInvite | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [inviteMutating, setInviteMutating] = useState<number | string | null>(null);

  // Load Users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setListFailed(false);
    try {
      const data = await api.listAdminUsers({
        q: q.trim() || undefined,
        role: role || undefined,
        status: status || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      if (data.total > 0 && page > Math.ceil(data.total / PAGE_SIZE)) {
        setPage(Math.ceil(data.total / PAGE_SIZE));
      }
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
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    void api
      .getMe()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  // Load Invites
  const loadInvites = useCallback(async () => {
    setInvitesLoading(true);
    setInviteError(null);
    try {
      const data = await api.listAdminInvites();
      setInvites(data.items || []);
      setSelectedInviteIds([]);
    } catch {
      setInvites([]);
      setInviteError('邀请码列表加载失败');
    } finally {
      setInvitesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'invites') return;
    const timer = window.setTimeout(() => {
      void loadInvites();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadInvites]);

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setForm(createFormInitial());
    setCreateError(null);
    setShowPassword(false);
  };
  const closeResetModal = () => {
    setResetUser(null);
    setResetForm(passwordFormInitial());
    setResetError(null);
    setShowResetPassword(false);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password.length < 12) return setCreateError('密码至少需要 12 个字符');
    setCreating(true);
    setCreateError(null);
    setSuccessMsg(null);
    try {
      await api.createAdminUser({ username: form.username, password: form.password, role: form.role });
      closeCreateModal();
      setSuccessMsg('用户创建成功');
      if (page === 1) void loadUsers();
      else setPage(1);
    } catch (error) {
      setCreateError(createErrorMessage(error instanceof Error ? error.message : ''));
    } finally {
      setCreating(false);
    }
  };

  const runMutation = async (key: string, kind: 'role' | 'status', work: () => Promise<unknown>, message: string) => {
    setMutating(key);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await work();
      setConfirmAction(null);
      setSuccessMsg(message);
      await loadUsers();
    } catch (error) {
      setErrorMsg(mutationErrorMessage(error instanceof Error ? error.message : '', kind));
    } finally {
      setMutating(null);
    }
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
    void runMutation(
      `${type}-${user.id}`,
      type === 'demote' ? 'role' : 'status',
      () =>
        type === 'demote'
          ? api.updateAdminUserRole(user.id, 'member')
          : api.updateAdminUserStatus(user.id, 'disabled'),
      type === 'demote' ? '用户角色已更新' : '用户已禁用'
    );
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetUser) return;
    if (resetForm.password.length < 12) return setResetError('密码至少需要 12 个字符');
    if (resetForm.password !== resetForm.confirmPassword) return setResetError('两次输入的密码不一致');
    setMutating(`password-${resetUser.id}`);
    setResetError(null);
    setSuccessMsg(null);
    try {
      await api.resetAdminUserPassword(resetUser.id, resetForm.password);
      const resetSelf = resetUser.id === currentUser?.id;
      closeResetModal();
      if (resetSelf) {
        try {
          await api.logout();
        } catch {
          /* token is intentionally stale */
        }
        localStorage.removeItem('kb_token');
        window.location.assign('/wang');
        return;
      }
      setSuccessMsg('密码已重置');
    } catch (error) {
      setResetError(mutationErrorMessage(error instanceof Error ? error.message : '', 'password'));
    } finally {
      setMutating(null);
    }
  };

  const switchTab = (tab: 'users' | 'invites') => {
    setActiveTab(tab);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  // Generate Invite Submission
  const handleGenerateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inviteMaxUses < 1 || inviteMaxUses > 1000) return setInviteError('最大使用次数需在 1 ~ 1000 之间');

    let validDays = 0;
    if (validDaysPreset === -1) {
      const parsed = parseInt(customValidDays, 10);
      if (isNaN(parsed) || parsed <= 0) return setInviteError('请输入有效的自定义天数（大于0的正整数）');
      validDays = parsed;
    } else {
      validDays = validDaysPreset;
    }

    if (createMode === 'custom') {
      const trimmed = customCode.trim().toUpperCase();
      if (trimmed.length !== 8) return setInviteError('自定义邀请码必须为 8 位字符');
    } else {
      if (inviteCount < 1 || inviteCount > 100) return setInviteError('单次生成数量应在 1 ~ 100 之间');
    }

    setInviteCreating(true);
    setInviteError(null);
    try {
      if (createMode === 'custom') {
        const created = await api.createAdminInvite({
          custom_code: customCode.trim().toUpperCase(),
          max_uses: inviteMaxUses,
          valid_days: validDays,
          remark: inviteRemark.trim() || undefined,
        });
        setShowInviteCreate(false);
        setGeneratedCodes([created.code || customCode.trim().toUpperCase()]);
      } else {
        const created = await api.createAdminInvite({
          count: inviteCount,
          max_uses: inviteMaxUses,
          valid_days: validDays,
          remark: inviteRemark.trim() || undefined,
        });
        setShowInviteCreate(false);
        if (created.codes && created.codes.length > 0) {
          setGeneratedCodes(created.codes);
        } else if (created.code) {
          setGeneratedCodes([created.code]);
        }
      }
      setSuccessMsg('邀请码生成成功');
      await loadInvites();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      setInviteError(msg || '生成邀请码失败');
    } finally {
      setInviteCreating(false);
    }
  };

  // Copy code helper
  const copyToClipboard = async (text: string, codeKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(codeKey);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setInviteError('复制失败，请手动选择复制');
    }
  };

  // Batch copy selected codes
  const handleBatchCopy = async () => {
    const selectedCodes = filteredInvites
      .filter((inv) => selectedInviteIds.includes(inv.id) && inv.code)
      .map((inv) => inv.code!)
      .join('\n');
    if (!selectedCodes) return;
    try {
      await navigator.clipboard.writeText(selectedCodes);
      setBatchCopied(true);
      setTimeout(() => setBatchCopied(false), 2000);
    } catch {
      setInviteError('批量复制失败，请手动复制');
    }
  };

  // Toggle invite status (Active/Disabled)
  const toggleInviteStatus = async (invite: AdminInvite) => {
    const nextStatus = invite.status === 'active' ? 'disabled' : 'active';
    setInviteMutating(invite.id);
    try {
      await api.updateAdminInvite(invite.id, { status: nextStatus });
      setSuccessMsg(nextStatus === 'active' ? '邀请码已启用' : '邀请码已禁用');
      await loadInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : '更新状态失败');
    } finally {
      setInviteMutating(null);
    }
  };

  // Batch Toggle status
  const handleBatchStatus = async (status: 'active' | 'disabled') => {
    if (selectedInviteIds.length === 0) return;
    setInviteMutating('batch-status');
    try {
      await api.batchUpdateAdminInvitesStatus(selectedInviteIds, status);
      setSuccessMsg(`已批量${status === 'active' ? '启用' : '禁用'} ${selectedInviteIds.length} 个邀请码`);
      await loadInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : '批量更新状态失败');
    } finally {
      setInviteMutating(null);
    }
  };

  // Delete invite
  const confirmDeleteInvite = async () => {
    if (!deleteTargetInvite) return;
    setInviteMutating(deleteTargetInvite.id);
    try {
      await api.deleteAdminInvite(deleteTargetInvite.id);
      setDeleteTargetInvite(null);
      setSuccessMsg('邀请码已删除');
      await loadInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : '删除邀请码失败');
    } finally {
      setInviteMutating(null);
    }
  };

  // Batch Delete
  const confirmBatchDelete = async () => {
    if (selectedInviteIds.length === 0) return;
    setInviteMutating('batch-delete');
    try {
      const res = await api.batchDeleteAdminInvites(selectedInviteIds);
      setBatchDeleteConfirm(false);
      setSuccessMsg(`成功批量删除 ${res.deleted} 个邀请码`);
      await loadInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : '批量删除失败');
    } finally {
      setInviteMutating(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (invite: AdminInvite) => {
    setEditInvite(invite);
    setEditRemark(invite.remark || '');
    setEditMaxUses(invite.max_uses ?? 1);
    setEditValidDaysMode('keep');
    setEditValidDays(0);
  };

  // Submit Edit
  const handleUpdateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editInvite) return;
    if (editMaxUses < editInvite.used_count) {
      return setInviteError(`最大使用次数不能少于已使用次数 (${editInvite.used_count})`);
    }

    setEditUpdating(true);
    setInviteError(null);
    try {
      const updateData: { remark?: string; max_uses?: number; valid_days?: number } = {
        remark: editRemark.trim(),
        max_uses: editMaxUses,
      };

      if (editValidDaysMode === 'preset') {
        updateData.valid_days = editValidDays;
      } else if (editValidDaysMode === 'custom') {
        updateData.valid_days = editValidDays;
      }

      await api.updateAdminInvite(editInvite.id, updateData);
      setEditInvite(null);
      setSuccessMsg('邀请码更新成功');
      await loadInvites();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : '更新邀请码失败');
    } finally {
      setEditUpdating(false);
    }
  };

  // Open View Users Modal
  const openViewUsers = async (invite: AdminInvite) => {
    setViewUsersInvite(invite);
    setInviteUsersLoading(true);
    setInviteUsersList([]);
    try {
      const res = await api.getAdminInviteUsers(invite.id);
      setInviteUsersList(res.items || []);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : '获取使用者记录失败');
    } finally {
      setInviteUsersLoading(false);
    }
  };

  // Filtered Invites
  const filteredInvites = invites.filter((inv) => {
    if (inviteSearch) {
      const q = inviteSearch.trim().toLowerCase();
      const matchCode = inv.code && inv.code.toLowerCase().includes(q);
      const matchRemark = inv.remark && inv.remark.toLowerCase().includes(q);
      const matchId = String(inv.id) === q;
      if (!matchCode && !matchRemark && !matchId) return false;
    }
    if (inviteStatusFilter) {
      const isExpired = inv.expires_at ? new Date(inv.expires_at).getTime() <= Date.now() : false;
      const isExhausted = inv.max_uses !== null && inv.used_count >= inv.max_uses;

      if (inviteStatusFilter === 'active') {
        if (inv.status !== 'active' || isExpired || isExhausted) return false;
      } else if (inviteStatusFilter === 'disabled') {
        if (inv.status !== 'disabled') return false;
      } else if (inviteStatusFilter === 'expired') {
        if (!isExpired) return false;
      } else if (inviteStatusFilter === 'exhausted') {
        if (!isExhausted) return false;
      }
    }
    return true;
  });

  // Select all checkbox handler
  const isAllSelected =
    filteredInvites.length > 0 && filteredInvites.every((inv) => selectedInviteIds.includes(inv.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedInviteIds([]);
    } else {
      setSelectedInviteIds(filteredInvites.map((inv) => inv.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedInviteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-[1140px] space-y-4">
      {/* Top Header */}
      <AdminPageHeader
        icon={Users}
        title="用户与注册管理"
        description="管理系统用户、角色权限，以及 8 位注册邀请码的生成、分发与使用追踪。"
        actions={
          activeTab === 'users' ? (
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              创建用户
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                setShowInviteCreate(true);
                setCreateMode('random');
                setInviteCount(1);
                setCustomCode('');
                setValidDaysPreset(0);
                setCustomValidDays('');
                setInviteMaxUses(1);
                setInviteRemark('');
                setInviteError(null);
              }}
            >
              <Sparkles className="h-4 w-4" />
              生成 8 位邀请码
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div role="tablist" aria-label="用户管理分类" className="flex border-b border-border-subtle">
        <button
          role="tab"
          aria-selected={activeTab === 'users'}
          type="button"
          onClick={() => switchTab('users')}
          className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'users'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-tertiary hover:text-text-primary'
          }`}
        >
          <Users className="h-4 w-4" />
          用户
          <span className="ml-1 rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-normal text-text-tertiary">
            {total}
          </span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'invites'}
          type="button"
          onClick={() => switchTab('invites')}
          className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'invites'
              ? 'border-brand text-brand'
              : 'border-transparent text-text-tertiary hover:text-text-primary'
          }`}
        >
          <Key className="h-4 w-4" />
          邀请码
          <span className="ml-1 rounded-full bg-surface-subtle px-2 py-0.5 text-xs font-normal text-text-tertiary">
            {invites.length}
          </span>
        </button>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-danger dark:border-red-900/50 dark:bg-red-950/20"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </span>
          <Button size="sm" onClick={() => void loadUsers()}>
            重新加载
          </Button>
        </div>
      )}
      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-success dark:border-emerald-900/50 dark:bg-emerald-950/20"
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Users Tab Content */}
      {activeTab === 'users' && (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
          {/* Filters */}
          <div className="grid gap-3 border-b border-border-subtle p-4 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
            <label className="relative block">
              <span className="sr-only">搜索用户名</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" />
              <input
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索用户名"
                className="min-h-10 w-full rounded-lg border border-border-default bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-brand"
              />
            </label>
            <select
              aria-label="角色筛选"
              value={role}
              onChange={(event) => {
                setRole(event.target.value as AdminUserRole | '');
                setPage(1);
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
                setStatus(event.target.value as AdminUserStatus | '');
                setPage(1);
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
                              onClick={() => updateRole(user, user.role === 'admin' ? 'member' : 'admin')}
                            >
                              {user.role === 'admin' ? '降为用户' : '设为管理员'}
                            </Button>
                            <Button
                              size="sm"

                              disabled={!!busy || (isSelf && user.status === 'active')}
                              title={isSelf && user.status === 'active' ? '不能禁用当前登录账户' : undefined}
                              onClick={() => updateStatus(user, user.status === 'active' ? 'disabled' : 'active')}
                            >
                              {user.status === 'active' ? '禁用' : '启用'}
                            </Button>
                            <Button
                              size="sm"

                              disabled={!!busy}
                              onClick={() => {
                                setResetUser(user);
                                setResetError(null);
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
                <Button size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  上一页
                </Button>
                <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Invites Tab Content */}
      {activeTab === 'invites' && (
        <section className="space-y-4">
          {/* Invite Toolbars & Filters */}
          <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" />
                <input
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="搜索 8 位邀请码 / 备注"
                  className="min-h-9 w-full rounded-lg border border-border-default bg-surface py-1.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <select
                aria-label="邀请码状态筛选"
                value={inviteStatusFilter}
                onChange={(e) => setInviteStatusFilter(e.target.value)}
                className="min-h-9 rounded-lg border border-border-default bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">全部状态</option>
                <option value="active">有效可用</option>
                <option value="exhausted">已用尽</option>
                <option value="expired">已过期</option>
                <option value="disabled">已禁用</option>
              </select>
              <Button size="sm" onClick={() => void loadInvites()} title="刷新列表">
                <RefreshCw className={`h-3.5 w-3.5 ${invitesLoading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>

            {/* Batch Action Pills */}
            {selectedInviteIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft/50 p-1.5 text-xs text-brand">
                <span className="font-semibold px-1.5">已选中 {selectedInviteIds.length} 项:</span>
                <Button size="sm" onClick={handleBatchCopy}>
                  {batchCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {batchCopied ? '已复制' : '复制多行'}
                </Button>
                <Button
                  size="sm"
                  disabled={inviteMutating === 'batch-status'}
                  onClick={() => handleBatchStatus('active')}
                >
                  批量启用
                </Button>
                <Button
                  size="sm"
                  disabled={inviteMutating === 'batch-status'}
                  onClick={() => handleBatchStatus('disabled')}
                >
                  批量禁用
                </Button>
                <Button
                  size="sm"
                  className="text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setBatchDeleteConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  批量删除
                </Button>
              </div>
            )}
          </div>

          {inviteError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-danger dark:border-red-900/50 dark:bg-red-950/20"
            >
              <span>{inviteError}</span>
              <Button size="sm" onClick={() => void loadInvites()}>
                重新加载
              </Button>
            </div>
          )}

          {/* Invite Table */}
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
            {invitesLoading ? (
              <p className="p-8 text-center text-sm text-text-tertiary">加载邀请码中...</p>
            ) : filteredInvites.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Key className="mx-auto h-8 w-8 text-text-tertiary opacity-50" />
                <p className="text-sm text-text-tertiary">
                  {inviteSearch || inviteStatusFilter ? '未找到符合条件的邀请码' : '暂无邀请码，点击上方按钮立即生成'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-surface-subtle text-text-tertiary">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          aria-label="全选邀请码"
                          className="h-4 w-4 rounded border-border-default text-brand focus:ring-brand"
                        />
                      </th>
                      <th className="px-4 py-3 font-medium">8位邀请码</th>
                      <th className="px-4 py-3 font-medium">备注说明</th>
                      <th className="px-4 py-3 font-medium">状态</th>
                      <th className="px-4 py-3 font-medium">使用进度</th>
                      <th className="px-4 py-3 font-medium">有效期限</th>
                      <th className="px-4 py-3 font-medium">创建时间</th>
                      <th className="px-4 py-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {filteredInvites.map((inv) => {
                      const isExpired = inv.expires_at ? new Date(inv.expires_at).getTime() <= Date.now() : false;
                      const isExhausted = inv.max_uses !== null && inv.used_count >= inv.max_uses;
                      const isSelected = selectedInviteIds.includes(inv.id);
                      const isCopyActive = copiedCode === `code-${inv.id}`;

                      let statusBadge = {
                        text: '有效',
                        bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                      };
                      if (inv.status === 'disabled') {
                        statusBadge = {
                          text: '已禁用',
                          bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                        };
                      } else if (isExpired) {
                        statusBadge = {
                          text: '已过期',
                          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                        };
                      } else if (isExhausted) {
                        statusBadge = {
                          text: '已用尽',
                          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                        };
                      }

                      return (
                        <tr
                          key={inv.id}
                          className={`transition-colors ${
                            isSelected ? 'bg-brand-soft/20' : 'hover:bg-surface-subtle/50'
                          }`}
                        >
                          <td className="w-10 px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(inv.id)}
                              aria-label={`选择邀请码 ${inv.code || inv.id}`}
                              className="h-4 w-4 rounded border-border-default text-brand focus:ring-brand"
                            />
                          </td>
                          <td className="px-4 py-3.5 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-sm tracking-wider font-bold text-brand bg-brand-soft px-2 py-0.5 rounded border border-brand/20">
                                {inv.code || `ID-${inv.id}`}
                              </span>
                              {inv.code && (
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(inv.code!, `code-${inv.id}`)}
                                  title="复制邀请码"
                                  className="p-1 rounded text-text-tertiary hover:text-brand hover:bg-surface-subtle transition-colors"
                                >
                                  {isCopyActive ? (
                                    <Check className="h-3.5 w-3.5 text-success" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-text-secondary max-w-[160px] truncate">
                            {inv.remark ? (
                              <span title={inv.remark}>{inv.remark}</span>
                            ) : (
                              <span className="text-text-tertiary">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg}`}
                            >
                              {statusBadge.text}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-medium text-text-primary">
                                  {inv.used_count} / {inv.max_uses ?? '不限'}
                                </span>
                                {inv.used_count > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openViewUsers(inv)}
                                    className="text-xs text-brand hover:underline font-medium"
                                  >
                                    查看使用者 ({inv.used_count})
                                  </button>
                                )}
                              </div>
                              {inv.max_uses && inv.max_uses > 0 && (
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-subtle">
                                  <div
                                    className={`h-full transition-all ${
                                      isExhausted ? 'bg-amber-500' : 'bg-brand'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.round((inv.used_count / inv.max_uses) * 100))}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-text-secondary">
                            {inv.expires_at ? (
                              <div className="space-y-0.5">
                                <div>{new Date(inv.expires_at).toLocaleDateString()}</div>
                                <div className="text-[11px] text-text-tertiary">
                                  {isExpired
                                    ? '已到期'
                                    : `剩 ${Math.max(
                                        1,
                                        Math.ceil(
                                          (new Date(inv.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                        )
                                      )} 天`}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                                永久有效
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-text-tertiary">
                            {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
  
                                onClick={() => openViewUsers(inv)}
                                title="查看使用过该邀请码的用户"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                使用者
                              </Button>
                              <Button
                                size="sm"
  
                                onClick={() => openEditModal(inv)}
                                title="编辑邀请码"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                编辑
                              </Button>
                              <Button
                                size="sm"
  
                                disabled={inviteMutating === inv.id}
                                onClick={() => toggleInviteStatus(inv)}
                                title={inv.status === 'active' ? '禁用该邀请码' : '启用该邀请码'}
                              >
                                {inv.status === 'active' ? (
                                  <ToggleRight className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4 text-text-tertiary" />
                                )}
                                {inv.status === 'active' ? '禁用' : '启用'}
                              </Button>
                              <Button
                                size="sm"
  
                                className="text-danger hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => setDeleteTargetInvite(inv)}
                                title="删除该邀请码"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
          </div>
        </section>
      )}

      {/* MODAL: Create User */}
      {showCreateModal && (
        <Modal title="创建用户" onClose={closeCreateModal}>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <p role="alert" className="text-sm text-danger">
                {createError}
              </p>
            )}
            <Field label="用户名">
              <input
                aria-label="用户名"
                required
                value={form.username}
                onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))}
                placeholder="请输入登录用户名"
                className="input"
              />
            </Field>
            <PasswordField
              value={form.password}
              onChange={(password) => setForm((value) => ({ ...value, password }))}
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
            <Field label="角色">
              <select
                aria-label="创建用户角色"
                value={form.role}
                onChange={(event) => setForm((value) => ({ ...value, role: event.target.value as AdminUserRole }))}
                className="input"
              >
                <option value="member">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </Field>
            <ModalActions
              onClose={closeCreateModal}
              disabled={creating}
              submitText={creating ? '创建中...' : '创建用户'}
            />
          </form>
        </Modal>
      )}

      {/* MODAL: Generate Invite Code (8 digits, custom days presets) */}
      {showInviteCreate && (
        <Modal title="生成注册邀请码" onClose={() => setShowInviteCreate(false)}>
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            {inviteError && (
              <p role="alert" className="text-sm text-danger">
                {inviteError}
              </p>
            )}

            {/* Mode selection: Random or Custom */}
            <div>
              <span className="block text-sm font-medium text-text-primary mb-1.5">生成模式</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateMode('random')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition ${
                    createMode === 'random'
                      ? 'border-brand bg-brand-soft text-brand shadow-sm'
                      : 'border-border-default bg-surface text-text-secondary hover:bg-surface-subtle'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  系统随机 (8位码)
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('custom')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-semibold transition ${
                    createMode === 'custom'
                      ? 'border-brand bg-brand-soft text-brand shadow-sm'
                      : 'border-border-default bg-surface text-text-secondary hover:bg-surface-subtle'
                  }`}
                >
                  <Key className="h-3.5 w-3.5" />
                  自定义指定 8 位码
                </button>
              </div>
            </div>

            {createMode === 'random' ? (
              <Field label="生成数量 (张)">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {[1, 5, 10, 20, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setInviteCount(num)}
                        className={`flex-1 rounded-md py-1 text-xs font-medium border transition ${
                          inviteCount === num
                            ? 'bg-brand text-white border-brand'
                            : 'bg-surface border-border-default text-text-secondary hover:bg-surface-subtle'
                        }`}
                      >
                        {num} 个
                      </button>
                    ))}
                  </div>
                  <input
                    aria-label="自定义生成数量"
                    type="number"
                    min={1}
                    max={100}
                    value={inviteCount}
                    onChange={(e) => setInviteCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                    className="input text-sm"
                    placeholder="输入数量 (1~100)"
                  />
                </div>
              </Field>
            ) : (
              <Field label="自定义 8 位邀请码">
                <input
                  aria-label="自定义邀请码"
                  required
                  maxLength={8}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                  placeholder="例如: VIP2026A (8位字符)"
                  className="input font-mono tracking-widest text-base font-bold uppercase"
                />
                <span className="mt-1 block text-xs text-text-tertiary">
                  必须为 8 位英文字母或数字（自动转大写，已输入 {customCode.length}/8）。
                </span>
              </Field>
            )}

            {/* Valid Days Presets (No datepicker) */}
            <div>
              <span className="block text-sm font-medium text-text-primary mb-1.5">有效时间</span>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {VALID_DAYS_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setValidDaysPreset(p.days);
                      if (p.days !== -1) setCustomValidDays('');
                    }}
                    className={`rounded-lg py-2 text-xs font-medium border transition ${
                      validDaysPreset === p.days
                        ? 'bg-brand text-white border-brand shadow-sm font-semibold'
                        : 'bg-surface border-border-default text-text-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {validDaysPreset === -1 && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={customValidDays}
                    onChange={(e) => setCustomValidDays(e.target.value)}
                    placeholder="输入自定义有效天数 (例如: 15)"
                    className="input text-sm flex-1"
                  />
                  <span className="text-sm text-text-secondary font-medium shrink-0">天</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="单码最大使用次数">
                <input
                  aria-label="最大使用次数"
                  type="number"
                  min={1}
                  max={1000}
                  value={inviteMaxUses}
                  onChange={(event) => setInviteMaxUses(Number(event.target.value) || 1)}
                  className="input"
                />
              </Field>
              <Field label="用途备注 (选填)">
                <input
                  aria-label="备注说明"
                  value={inviteRemark}
                  onChange={(event) => setInviteRemark(event.target.value)}
                  placeholder="如: 社区推广、内测"
                  className="input"
                />
              </Field>
            </div>

            <ModalActions
              onClose={() => setShowInviteCreate(false)}
              disabled={inviteCreating}
              submitText={inviteCreating ? '正在生成...' : '立即生成邀请码'}
            />
          </form>
        </Modal>
      )}

      {/* MODAL: Generated Codes Result Showcase */}
      {generatedCodes.length > 0 && (
        <Modal
          title={`成功生成 ${generatedCodes.length} 个 8 位邀请码`}
          onClose={() => setGeneratedCodes([])}
        >
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              邀请码已入库保存并在列表中可见。您可以一键复制以下生成的邀请码：
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-lg border border-border-default bg-surface-subtle p-3">
              {generatedCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded bg-surface p-2 border border-border-subtle"
                >
                  <span className="font-mono text-sm font-bold tracking-widest text-brand">{code}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(code, `gen-${idx}`)}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-brand"
                  >
                    {copiedCode === `gen-${idx}` ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedCode === `gen-${idx}` ? '已复制' : '复制'}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(generatedCodes.join('\n'));
                  setBatchCopied(true);
                  setTimeout(() => setBatchCopied(false), 2000);
                }}
              >
                {batchCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {batchCopied ? '已复制全部' : '一键复制全部 (多行)'}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setGeneratedCodes([])}>
                完成
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Edit Invite */}
      {editInvite && (
        <Modal title={`编辑邀请码「${editInvite.code || `ID-${editInvite.id}`}」`} onClose={() => setEditInvite(null)}>
          <form onSubmit={handleUpdateInvite} className="space-y-4">
            {inviteError && (
              <p role="alert" className="text-sm text-danger">
                {inviteError}
              </p>
            )}
            <Field label="用途备注">
              <input
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                placeholder="更新邀请码备注"
                className="input"
              />
            </Field>

            <Field label="最大使用次数">
              <input
                type="number"
                min={editInvite.used_count}
                max={1000}
                value={editMaxUses}
                onChange={(e) => setEditMaxUses(Number(e.target.value) || 1)}
                className="input"
              />
              <span className="mt-1 block text-xs text-text-tertiary">
                当前已使用 {editInvite.used_count} 次，设定值不可低于已使用次数。
              </span>
            </Field>

            <div>
              <span className="block text-sm font-medium text-text-primary mb-1.5">修改有效时间</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEditValidDaysMode('keep')}
                  className={`rounded-lg py-2 text-xs font-medium border transition ${
                    editValidDaysMode === 'keep'
                      ? 'bg-brand text-white border-brand'
                      : 'bg-surface border-border-default text-text-secondary hover:bg-surface-subtle'
                  }`}
                >
                  保持不变
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditValidDaysMode('preset');
                    setEditValidDays(0);
                  }}
                  className={`rounded-lg py-2 text-xs font-medium border transition ${
                    editValidDaysMode === 'preset' && editValidDays === 0
                      ? 'bg-brand text-white border-brand'
                      : 'bg-surface border-border-default text-text-secondary hover:bg-surface-subtle'
                  }`}
                >
                  设为永久有效
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditValidDaysMode('custom');
                    setEditValidDays(30);
                  }}
                  className={`rounded-lg py-2 text-xs font-medium border transition ${
                    editValidDaysMode === 'custom'
                      ? 'bg-brand text-white border-brand'
                      : 'bg-surface border-border-default text-text-secondary hover:bg-surface-subtle'
                  }`}
                >
                  重新设置天数
                </button>
              </div>

              {editValidDaysMode === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={editValidDays}
                    onChange={(e) => setEditValidDays(Number(e.target.value) || 1)}
                    placeholder="输入从现在开始的有效天数"
                    className="input text-sm flex-1"
                  />
                  <span className="text-sm text-text-secondary font-medium shrink-0">天 (从当前起算)</span>
                </div>
              )}
            </div>

            <ModalActions
              onClose={() => setEditInvite(null)}
              disabled={editUpdating}
              submitText={editUpdating ? '保存中...' : '保存修改'}
            />
          </form>
        </Modal>
      )}

      {/* MODAL: View Invite Registered Users */}
      {viewUsersInvite && (
        <Modal
          title={`邀请码「${viewUsersInvite.code || `ID-${viewUsersInvite.id}`}」的使用者`}
          onClose={() => setViewUsersInvite(null)}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-text-secondary border-b border-border-subtle pb-2">
              <span>共 {inviteUsersList.length} 位用户通过此码注册</span>
              <span>
                上限: {viewUsersInvite.used_count} / {viewUsersInvite.max_uses ?? '不限'}
              </span>
            </div>

            {inviteUsersLoading ? (
              <p className="py-6 text-center text-sm text-text-tertiary">加载使用者记录中...</p>
            ) : inviteUsersList.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <Users className="mx-auto h-6 w-6 text-text-tertiary opacity-40" />
                <p className="text-sm text-text-tertiary">该邀请码目前暂未被任何用户使用</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {inviteUsersList.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-subtle p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      <Users className="h-4 w-4 text-brand" />
                      <span>{u.username}</span>
                    </div>
                    <span className="text-xs text-text-tertiary">{new Date(u.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewUsersInvite(null)}>关闭</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Single Delete Invite */}
      {deleteTargetInvite && (
        <Modal title="确认删除邀请码" onClose={() => setDeleteTargetInvite(null)}>
          <p className="text-sm text-text-secondary">
            确定要彻底删除邀请码「
            <span className="font-mono font-bold text-text-primary">
              {deleteTargetInvite.code || `ID-${deleteTargetInvite.id}`}
            </span>
            」吗？删除后该码将无法继续用于注册。
          </p>
          <ModalActions
            onClose={() => setDeleteTargetInvite(null)}
            disabled={inviteMutating === deleteTargetInvite.id}
            onSubmit={confirmDeleteInvite}
            submitText={inviteMutating === deleteTargetInvite.id ? '删除中...' : '确认删除'}
          />
        </Modal>
      )}

      {/* MODAL: Batch Delete Invites */}
      {batchDeleteConfirm && (
        <Modal title="确认批量删除邀请码" onClose={() => setBatchDeleteConfirm(false)}>
          <p className="text-sm text-text-secondary">
            确定要删除选中的 <span className="font-bold text-danger">{selectedInviteIds.length}</span> 个邀请码吗？
            删除后这些邀请码将立即失效且不可恢复。
          </p>
          <ModalActions
            onClose={() => setBatchDeleteConfirm(false)}
            disabled={inviteMutating === 'batch-delete'}
            onSubmit={confirmBatchDelete}
            submitText={inviteMutating === 'batch-delete' ? '批量删除中...' : '确认全部删除'}
          />
        </Modal>
      )}

      {/* User Actions Confirmation Modal */}
      {confirmAction && (
        <Modal
          title={confirmAction.type === 'disable' ? '确认禁用用户' : '确认修改角色'}
          onClose={() => setConfirmAction(null)}
        >
          <p className="text-sm text-text-secondary">
            {confirmAction.type === 'disable'
              ? `禁用后「${confirmAction.user.username}」当前登录状态将立即失效，确定继续吗？`
              : `确定要将管理员「${confirmAction.user.username}」调整为普通用户吗？`}
          </p>
          <ModalActions
            onClose={() => setConfirmAction(null)}
            disabled={!!mutating}
            onSubmit={confirmMutation}
            submitText={mutating ? '处理中...' : '确认执行'}
          />
        </Modal>
      )}

      {/* User Reset Password Modal */}
      {resetUser && (
        <Modal title={`重置「${resetUser.username}」的密码`} onClose={closeResetModal}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {resetError && (
              <p role="alert" className="text-sm text-danger">
                {resetError}
              </p>
            )}
            {resetUser.id === currentUser?.id && (
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                重置当前账户密码后，需要重新登录。
              </p>
            )}
            <PasswordField
              value={resetForm.password}
              onChange={(password) => setResetForm((value) => ({ ...value, password }))}
              visible={showResetPassword}
              onToggle={() => setShowResetPassword((value) => !value)}
              label="新密码"
            />
            <Field label="确认新密码">
              <input
                aria-label="确认新密码"
                required
                type={showResetPassword ? 'text' : 'password'}
                value={resetForm.confirmPassword}
                onChange={(event) => setResetForm((value) => ({ ...value, confirmPassword: event.target.value }))}
                className="input"
              />
            </Field>
            <ModalActions
              onClose={closeResetModal}
              disabled={!!mutating}
              submitText={mutating ? '重置中...' : '重置密码'}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-text-primary">
      {label}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function PasswordField({
  value,
  onChange,
  visible,
  onToggle,
  label = '密码',
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <Field label={label}>
      <span className="relative block">
        <input
          aria-label={label}
          required
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input pr-10"
        />
        <button
          type="button"
          aria-label={visible ? '隐藏密码' : '显示密码'}
          onClick={onToggle}
          className="absolute inset-y-0 right-0 px-3 text-text-tertiary"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
      <span className="mt-1 block text-xs font-normal text-text-tertiary">至少 12 个字符。</span>
    </Field>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md space-y-4 rounded-xl border border-border-default bg-surface p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            aria-label="关闭对话框"
            onClick={onClose}
            className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-subtle transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  disabled,
  submitText,
  onSubmit,
}: {
  onClose: () => void;
  disabled: boolean;
  submitText: string;
  onSubmit?: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
      <Button onClick={onClose} disabled={disabled}>
        取消
      </Button>
      <Button type={onSubmit ? 'button' : 'submit'} variant="primary" disabled={disabled} onClick={onSubmit}>
        {submitText}
      </Button>
    </div>
  );
}
