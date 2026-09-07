import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, AlertCircle, CheckCircle, Eye, EyeOff, ShieldCheck, Info } from 'lucide-react';
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
    try { await api.updateCredentials({ username: account.username.trim(), current_password: account.currentPassword, ...(account.newPassword ? { new_password: account.newPassword } : {}) }); localStorage.removeItem('kb_token'); window.location.assign('/wang'); }
    catch (err: any) { setErrorMsg(err.message || '管理员账户更新失败，请稍后重试'); } finally { setAccountSaving(false); }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-text-tertiary">加载系统配置中...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6 py-2">
      <AdminPageHeader icon={Settings} title="系统配置" description="管理站点信息、前台展示与管理员账户。" />

      {errorMsg && (
        <div role="alert" className="flex items-center gap-2 rounded-ds-md border border-red-200 bg-red-50 p-3 text-sm text-danger">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div role="status" className="flex items-center gap-2 rounded-ds-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-success">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
        <div className="border-b border-border-subtle px-5 py-4 sm:px-6"><h2 className="text-base font-semibold text-text-primary">站点信息</h2><p className="mt-1 text-sm text-text-tertiary">控制前台品牌名称、说明和页脚内容。</p></div>
        <div className="px-5 sm:px-6">
          {[['站点名称','显示在前台 Header、页面标题和品牌区域。','site-name','site_name'],['站点副标题','用一句话说明知识库的内容定位。','site-subtitle','site_subtitle']].map(([label,description,id,key]) => <div key={key} className="grid gap-2 border-b border-border-subtle py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6"><div><label htmlFor={id} className="text-sm font-medium text-text-primary">{label}</label><p className="mt-1 text-xs leading-5 text-text-tertiary">{description}</p></div><input id={id} value={settings[key] || ''} onChange={(e) => handleChange(key, e.target.value)} className="min-h-10 w-full max-w-[560px] rounded-lg border border-border-default bg-surface px-3 text-sm text-text-primary outline-none transition focus:ring-2 focus:ring-brand" /></div>)}
          <div className="grid gap-2 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6"><div><label htmlFor="footer-text" className="text-sm font-medium text-text-primary">页脚文字</label><p className="mt-1 text-xs leading-5 text-text-tertiary">用于版权信息或简短的站点说明。</p></div><textarea id="footer-text" value={settings.footer_text || ''} onChange={(e) => handleChange('footer_text', e.target.value)} rows={3} className="min-h-20 w-full max-w-[560px] rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:ring-2 focus:ring-brand" /></div>
        </div><div className="flex justify-end border-t border-border-subtle px-5 py-4 sm:px-6"><Button type="submit" variant="primary" disabled={saving}><Save className="w-4 h-4" /><span>{saving ? '保存中...' : '保存站点设置'}</span></Button></div>
      </form>
      <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm"><div className="border-b border-border-subtle px-5 py-4 sm:px-6"><h2 className="text-base font-semibold text-text-primary">前台显示</h2><p className="mt-1 text-sm text-text-tertiary">控制公开页面中的辅助信息和资源能力。</p></div><div className="px-5 sm:px-6">{[['allow_download','允许访客下载附件','在文章附件区域显示下载入口'],['show_views','显示文章浏览量','在文章标题附近展示阅读计数']].map(([key,title,description]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-5 border-b border-border-subtle py-5 last:border-0"><span><span className="block text-sm font-medium text-text-primary">{title}</span><span className="mt-1 block text-xs text-text-tertiary">{description}</span></span><input type="checkbox" checked={settings[key] === 'true'} onChange={(e) => handleChange(key, e.target.checked ? 'true' : 'false')} className="h-5 w-9 appearance-none rounded-full bg-slate-200 transition checked:bg-brand after:block after:h-4 after:w-4 after:translate-x-0.5 after:rounded-full after:bg-white after:transition checked:after:translate-x-4 focus:ring-2 focus:ring-brand" /></label>)}</div></section>
      <form onSubmit={handleAccountSave} className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm"><div className="border-b border-border-subtle px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand"/><h2 className="text-base font-semibold text-text-primary">管理员账户</h2></div><p className="mt-1 text-sm text-text-tertiary">修改后台登录账号和密码。凭据修改后需要重新登录。</p></div><div className="grid gap-6 px-5 py-5 md:grid-cols-[220px_minmax(0,1fr)] sm:px-6"><div className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800"><Info className="mr-1 inline h-4 w-4"/>修改账号或密码后，当前登录状态将失效。</div><div className="max-w-[520px] space-y-4">{[['当前账号','username','text',''],['当前密码','currentPassword','password','请输入当前密码'],['新密码','newPassword','password','不修改密码请留空'],['确认新密码','confirmPassword','password','再次输入新密码']].map(([label,key,type,placeholder]) => <label key={key} className="block text-sm font-medium text-text-primary">{label}<span className="relative mt-1.5 block"><input type={type === 'password' && !showPasswords ? 'password' : 'text'} value={account[key as keyof typeof account]} placeholder={placeholder} onChange={(e) => setAccount({ ...account, [key]: e.target.value })} className="min-h-10 w-full rounded-lg border border-border-default bg-surface px-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-brand"/>{type === 'password' && <button type="button" aria-label={showPasswords ? '隐藏密码' : '显示密码'} onClick={() => setShowPasswords(!showPasswords)} className="absolute inset-y-0 right-0 px-3 text-text-tertiary">{showPasswords ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button>}</span></label>)}</div></div><div className="flex items-center justify-between gap-4 border-t border-border-subtle px-5 py-4 text-xs text-text-tertiary sm:px-6"><span>修改账号或密码后需要重新登录。</span><Button type="submit" variant="primary" disabled={accountSaving}><ShieldCheck className="h-4 w-4"/><span>{accountSaving ? '更新中...' : '更新管理员账户'}</span></Button></div></form>
    </div>
  );
};
