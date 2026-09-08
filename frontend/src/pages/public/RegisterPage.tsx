import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { sanitizeReturnTo } from '../../utils/returnTo';

export const RegisterPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);

  const target = sanitizeReturnTo(query.get('returnTo'));

  if (loading) {
    return (
      <main className="flex min-h-[70vh] w-full flex-1 items-center justify-center text-sm text-text-tertiary">
        正在恢复登录状态…
      </main>
    );
  }

  if (user) {
    return <Navigate to={target} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (name.length < 3 || name.length > 32) {
      return setError('用户名长度应为 3–32 个字符');
    }
    if (password.length < 12) {
      return setError('密码至少需要 12 个字符');
    }
    if (password !== confirm) {
      return setError('两次密码不一致');
    }
    if (!invite.trim()) {
      return setError('请输入邀请码');
    }
    if (submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await api.memberRegister(name, password, invite.trim());
      setPassword('');
      setConfirm('');
      setInvite('');
      navigate(
        `/login?registered=1${target === '/' ? '' : `&returnTo=${encodeURIComponent(target)}`}`,
        { replace: true }
      );
    } catch {
      setError('注册失败，请检查邀请码是否有效');
    } finally {
      setSubmitting(false);
    }
  };

  const login = `/login${target === '/' ? '' : `?returnTo=${encodeURIComponent(target)}`}`;

  return (
    <main className="flex min-h-[calc(100vh-10rem)] w-full flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-sm sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-xs">
            <UserPlus className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">创建账户</h1>
          <p className="mt-2 text-sm text-text-tertiary">
            使用管理员提供的邀请码完成注册。
          </p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-text-secondary">
            用户名
            <input
              aria-label="用户名"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-text-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            密码
            <div className="relative mt-1.5">
              <input
                aria-label="密码"
                autoComplete="new-password"
                type={visible ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 pr-11 text-text-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="button"
                aria-label={visible ? '隐藏密码' : '显示密码'}
                onClick={() => setVisible((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-text-tertiary hover:text-text-secondary"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            确认密码
            <input
              aria-label="确认密码"
              autoComplete="new-password"
              type={visible ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-text-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <label className="block text-sm font-medium text-text-secondary">
            邀请码
            <input
              aria-label="邀请码"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-text-primary outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}

          <button
            disabled={submitting}
            className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white shadow-xs transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '注册中…' : '注册'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-tertiary">
          已有账号？{' '}
          <Link className="font-semibold text-brand hover:underline" to={login}>
            登录
          </Link>
        </p>
      </section>
    </main>
  );
};
