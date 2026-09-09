import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { ApiError } from '../../api';
import { useAuth } from '../../auth/useAuth';
import { SEOHead } from '../../components/SEOHead';
import type { PublicOutletContext } from '../../components/publicLayoutContext';

type PasswordFieldProps = {
  label: string;
  value: string;
  autoComplete: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

const PasswordField = ({ label, value, autoComplete, visible, onChange, onToggle }: PasswordFieldProps) => (
  <label className="block text-sm font-medium text-text-secondary">
    {label}
    <div className="relative mt-1.5">
      <input
        aria-label={label}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 pr-11 text-text-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <button
        type="button"
        aria-label={`${visible ? '隐藏' : '显示'}${label}`}
        onClick={onToggle}
        className="absolute inset-y-0 right-0 px-3 text-text-tertiary transition-colors hover:text-text-secondary"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </label>
);

export const AccountSecurityPage: React.FC = () => {
  const { siteInfo } = useOutletContext<PublicOutletContext>();
  const { user, loading, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visibleField, setVisibleField] = useState<'current' | 'new' | 'confirm' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const siteName = siteInfo?.site_name || '知识库';

  if (loading) {
    return <main className="flex min-h-[70vh] w-full flex-1 items-center justify-center text-sm text-text-tertiary">正在验证登录状态…</main>;
  }
  if (!user) {
    return <Navigate to="/login?returnTo=%2Faccount%2Fsecurity" replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请完整填写三个密码字段');
      return;
    }
    if (newPassword.length < 12) {
      setError('新密码至少需要 12 个字符');
      return;
    }
    if (newPassword === currentPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setVisibleField(null);
      setSuccess(true);
    } catch (reason) {
      setCurrentPassword('');
      setError(
        reason instanceof ApiError && reason.status === 404
          ? '修改密码服务尚未生效，请重启后端服务后重试'
          : reason instanceof ApiError
          ? reason.message
          : '无法连接密码服务，请确认后端服务正在运行'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="w-full flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <SEOHead
        title={`账号安全 - ${siteName}`}
        description="修改当前账号的登录密码。"
        canonicalPath={null}
        siteName={siteName}
        robots="noindex,nofollow"
      />
      <div className="mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <aside className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-text-primary">账号安全</h1>
          <p className="mt-2 text-sm leading-6 text-text-tertiary">
            当前账号：<span className="font-semibold text-text-secondary">{user.username}</span>
          </p>
          <div className="mt-6 rounded-xl border border-border-subtle bg-surface-subtle p-4 text-sm leading-6 text-text-tertiary">
            密码修改后，当前设备会自动续签登录状态，其他设备上的旧登录状态将失效。
          </div>
        </aside>

        <section className="rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-sm sm:p-8">
          <div className="mb-7">
            <div className="flex items-center gap-2 text-text-primary">
              <KeyRound className="h-5 w-5 text-brand" />
              <h2 className="text-lg font-bold">修改登录密码</h2>
            </div>
            <p className="mt-2 text-sm text-text-tertiary">新密码至少 12 个字符，且不能与当前密码相同。</p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <PasswordField
              label="当前密码"
              value={currentPassword}
              autoComplete="current-password"
              visible={visibleField === 'current'}
              onChange={setCurrentPassword}
              onToggle={() => setVisibleField((field) => field === 'current' ? null : 'current')}
            />
            <PasswordField
              label="新密码"
              value={newPassword}
              autoComplete="new-password"
              visible={visibleField === 'new'}
              onChange={setNewPassword}
              onToggle={() => setVisibleField((field) => field === 'new' ? null : 'new')}
            />
            <PasswordField
              label="确认新密码"
              value={confirmPassword}
              autoComplete="new-password"
              visible={visibleField === 'confirm'}
              onChange={setConfirmPassword}
              onToggle={() => setVisibleField((field) => field === 'confirm' ? null : 'confirm')}
            />

            {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {success && (
              <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                密码已修改，当前登录状态已安全续签。
              </p>
            )}

            <button
              disabled={submitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-semibold text-white shadow-xs transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              <span>{submitting ? '保存中…' : '保存新密码'}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};
