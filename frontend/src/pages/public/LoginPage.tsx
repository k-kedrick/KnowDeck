import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, LogIn } from 'lucide-react';
import { ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { sanitizeReturnTo } from '../../utils/returnTo';

export const LoginPage: React.FC = () => {
  const { user, loading, login } = useAuth();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      await login(username.trim(), password);
      setPassword('');
      navigate(target, { replace: true });
    } catch (reason) {
      setPassword('');
      setError(
        reason instanceof ApiError && reason.status === 401
          ? '用户名或密码错误'
          : reason instanceof ApiError && reason.status === 403
          ? '账户已被禁用'
          : '登录失败，请稍后重试'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const registerTo = `/register${target === '/' ? '' : `?returnTo=${encodeURIComponent(target)}`}`;

  return (
    <main className="flex min-h-[calc(100vh-10rem)] w-full flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface-elevated p-6 shadow-sm sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-xs">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">欢迎回来</h1>
          <p className="mt-2 text-sm text-text-tertiary">
            登录后查看知识库受保护的内容。
          </p>
        </div>

        {query.get('registered') === '1' && (
          <p
            role="status"
            className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
          >
            注册成功，请使用新账户登录。
          </p>
        )}

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
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-semibold text-white shadow-xs transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            <span>{submitting ? '登录中…' : '登录'}</span>
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-tertiary">
          没有账号？{' '}
          <Link className="font-semibold text-brand hover:underline" to={registerTo}>
            使用邀请码注册
          </Link>
        </p>
      </section>
    </main>
  );
};
