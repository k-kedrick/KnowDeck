import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, AlertCircle, CheckCircle, Eye, EyeOff, ShieldCheck, Info, Globe, Sliders } from 'lucide-react';
import { api } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Button } from '../../components/ui/Button';

export const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    site_name: '知识库',
    site_subtitle: '简洁、清晰的只读知识库与博客系统',
    footer_text: '© 2026 知识库. All Rights Reserved. Built with Go & React.',
    allow_download: 'true',
    show_author: 'true',
    show_views: 'true',
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [account, setAccount] = useState({ username: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [accountSaving, setAccountSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [data, user] = await Promise.all([api.getSettings(), api.getMe()]);
      setAccount((current) => ({ ...current, username: user.username }));
      if (data && Object.keys(data).length > 0) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || '加载系统配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.saveSettings(settings);
      try {
        localStorage.removeItem('cached_site_info');
      } catch {}
      setSuccessMsg('系统全局配置已成功保存并立即生效');
    } catch (err: any) {
      setErrorMsg(err.message || '保存系统配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAccountSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!account.currentPassword) { setErrorMsg('请输入当前密码'); return; }
    if (!account.username.trim() || (account.username.trim() === account.username && !account.newPassword)) { setErrorMsg('账号或密码没有变化'); return; }
    if (account.newPassword && account.newPassword.length < 12) { setErrorMsg('新密码至少需要 12 个字符'); return; }
    if (account.newPassword !== account.confirmPassword) { setErrorMsg('两次输入的新密码不一致'); return; }
    setAccountSaving(true); setErrorMsg(null);
    try {
      await api.updateCredentials({
        username: account.username.trim(),
        current_password: account.currentPassword,
        ...(account.newPassword ? { new_password: account.newPassword } : {}),
      });
      localStorage.removeItem('kb_token');
      window.location.assign('/wang');
    } catch (err: any) {
      setErrorMsg(err.message || '管理员账户更新失败，请稍后重试');
    } finally {
      setAccountSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-text-tertiary">加载系统配置中...</div>;
  }

  return (
    <div className="w-full space-y-5 py-1">
      <AdminPageHeader icon={Settings} title="系统配置" description="管理站点信息、前台展示与管理员账户。" />

      {errorMsg && (
        <div role="alert" className="flex items-center gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div role="status" className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 1. Site Info Section */}
      <form onSubmit={handleSave} className="admin-surface overflow-hidden">
        <div className="border-b border-border-subtle/80 px-6 py-4 sm:px-8 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-brand">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">站点信息</h2>
            <p className="text-xs text-text-tertiary">控制前台品牌名称、说明和页脚内容。</p>
          </div>
        </div>

        <div className="px-6 sm:px-8 divide-y divide-border-subtle/70">
          {[
            ['站点名称', '显示在前台 Header、页面标题和品牌区域。', 'site-name', 'site_name'],
            ['站点副标题', '用一句话说明知识库的内容定位。', 'site-subtitle', 'site_subtitle'],
          ].map(([label, description, id, key]) => (
            <div key={key} className="grid gap-2 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:items-center">
              <div>
                <label htmlFor={id} className="text-sm font-semibold text-text-primary">{label}</label>
                <p className="mt-0.5 text-xs text-text-tertiary">{description}</p>
              </div>
              <input
                id={id}
                value={settings[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                className="min-h-10 w-full max-w-[560px] rounded-xl border border-border-default/80 bg-surface px-3.5 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          ))}

          <div className="grid gap-2 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
            <div>
              <label htmlFor="footer-text" className="text-sm font-semibold text-text-primary">页脚文字</label>
              <p className="mt-0.5 text-xs text-text-tertiary">用于版权信息或简短的站点说明。</p>
            </div>
            <textarea
              id="footer-text"
              value={settings.footer_text || ''}
              onChange={(e) => handleChange('footer_text', e.target.value)}
              rows={3}
              className="min-h-20 w-full max-w-[560px] rounded-xl border border-border-default/80 bg-surface px-3.5 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border-subtle/80 bg-surface-subtle/40 px-6 py-4 sm:px-8">
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="w-4 h-4" />
            <span>{saving ? '保存中...' : '保存站点设置'}</span>
          </Button>
        </div>
      </form>

      {/* 2. Frontend Display Controls */}
      <section className="admin-surface overflow-hidden">
        <div className="border-b border-border-subtle/80 px-6 py-4 sm:px-8 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">前台显示</h2>
            <p className="text-xs text-text-tertiary">控制公开页面中的辅助信息和资源能力。</p>
          </div>
        </div>

        <div className="px-6 sm:px-8 divide-y divide-border-subtle/70">
          {[
            ['allow_download', '允许访客下载附件', '在文章附件区域显示下载入口'],
            ['show_views', '显示文章浏览量', '在文章标题附近展示阅读计数'],
          ].map(([key, title, description]) => {
            const isChecked = settings[key] === 'true';
            return (
              <div key={key} className="flex items-center justify-between gap-5 py-4">
                <div>
                  <span className="block text-sm font-semibold text-text-primary">{title}</span>
                  <span className="mt-0.5 block text-xs text-text-tertiary">{description}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isChecked}
                  onClick={() => handleChange(key, isChecked ? 'false' : 'true')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                    isChecked ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      isChecked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Admin Account Security */}
      <form onSubmit={handleAccountSave} className="admin-surface overflow-hidden">
        <div className="border-b border-border-subtle/80 px-6 py-4 sm:px-8 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary">管理员账户</h2>
            <p className="text-xs text-text-tertiary">修改后台登录账号和密码。凭据修改后需要重新登录。</p>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-[220px_minmax(0,1fr)] sm:px-8">
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-xs leading-relaxed text-blue-800 dark:text-blue-300 h-fit">
            <Info className="mr-1.5 inline h-4 w-4 text-brand" />
            修改账号或密码后，当前登录状态将失效，系统将引导您使用新凭据重新登录。
          </div>

          <div className="max-w-[520px] space-y-4">
            {[
              ['当前账号', 'username', 'text', ''],
              ['当前密码', 'currentPassword', 'password', '请输入当前密码'],
              ['新密码', 'newPassword', 'password', '不修改密码请留空 (至少12位)'],
              ['确认新密码', 'confirmPassword', 'password', '再次输入新密码'],
            ].map(([label, key, type, placeholder]) => (
              <label key={key} className="block text-xs font-semibold text-text-secondary">
                {label}
                <span className="relative mt-1.5 block">
                  <input
                    type={type === 'password' && !showPasswords ? 'password' : 'text'}
                    value={account[key as keyof typeof account]}
                    placeholder={placeholder}
                    onChange={(e) => setAccount({ ...account, [key]: e.target.value })}
                    className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3.5 pr-10 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  {type === 'password' && (
                    <button
                      type="button"
                      aria-label={showPasswords ? '隐藏密码' : '显示密码'}
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute inset-y-0 right-0 px-3 text-text-tertiary hover:text-text-primary transition"
                    >
                      {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border-subtle/80 bg-surface-subtle/40 px-6 py-4 text-xs text-text-tertiary sm:px-8">
          <span>修改账号或密码后需要重新登录。</span>
          <Button type="submit" variant="primary" disabled={accountSaving}>
            <ShieldCheck className="h-4 w-4" />
            <span>{accountSaving ? '更新中...' : '更新管理员账户'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};

