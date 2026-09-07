import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';
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

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getSettings();
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

  if (loading) {
    return <div className="py-16 text-center text-sm text-text-tertiary">加载系统配置中...</div>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Settings} title="系统配置" description="管理知识库品牌、页脚信息与前台展示选项。" />

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

      <form onSubmit={handleSave} className="max-w-5xl divide-y divide-border-subtle border-y border-border-subtle">
        <div className="grid gap-3 py-5 md:grid-cols-[15rem_minmax(0,36rem)] md:gap-8">
          <div><label htmlFor="site-name" className="text-sm font-semibold text-text-primary">站点名称</label><p className="mt-1 text-xs leading-5 text-text-tertiary">显示在前台 Header、页面标题和品牌区域。</p></div>
          <input
            id="site-name"
            type="text"
            value={settings.site_name || ''}
            onChange={(e) => handleChange('site_name', e.target.value)}
            className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="grid gap-3 py-5 md:grid-cols-[15rem_minmax(0,36rem)] md:gap-8">
          <div><label htmlFor="site-subtitle" className="text-sm font-semibold text-text-primary">站点副标题</label><p className="mt-1 text-xs leading-5 text-text-tertiary">用一句话说明知识库的内容定位。</p></div>
          <input
            id="site-subtitle"
            type="text"
            value={settings.site_subtitle || ''}
            onChange={(e) => handleChange('site_subtitle', e.target.value)}
            className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="grid gap-3 py-5 md:grid-cols-[15rem_minmax(0,36rem)] md:gap-8">
          <div><label htmlFor="footer-text" className="text-sm font-semibold text-text-primary">页脚文字</label><p className="mt-1 text-xs leading-5 text-text-tertiary">用于版权信息或简短的站点说明。</p></div>
          <textarea
            id="footer-text"
            value={settings.footer_text || ''}
            onChange={(e) => handleChange('footer_text', e.target.value)}
            rows={2}
            className="w-full rounded-ds-md border border-border-default bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="grid gap-3 py-5 md:grid-cols-[15rem_minmax(0,36rem)] md:gap-8">
          <div><h2 className="text-sm font-semibold text-text-primary">前台显示选项</h2><p className="mt-1 text-xs leading-5 text-text-tertiary">控制文章页可见的辅助信息与资源能力。</p></div>
          <div className="divide-y divide-border-subtle rounded-ds-md border border-border-subtle bg-surface">
          <label className="flex cursor-pointer items-center justify-between gap-6 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-text-primary">允许访客下载附件</div>
              <div className="mt-0.5 text-xs text-text-tertiary">显示资源附件下载链接</div>
            </div>
            <input
              type="checkbox"
              checked={settings.allow_download === 'true'}
              onChange={(e) => handleChange('allow_download', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-border-default text-brand focus:ring-brand"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-6 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-text-primary">显示文章浏览量</div>
              <div className="mt-0.5 text-xs text-text-tertiary">在文章标题附近展示阅读计数</div>
            </div>
            <input
              type="checkbox"
              checked={settings.show_views === 'true'}
              onChange={(e) => handleChange('show_views', e.target.checked ? 'true' : 'false')}
              className="h-4 w-4 rounded border-border-default text-brand focus:ring-brand"
            />
          </label>
          </div>
        </div>

        <div className="flex justify-end py-5 md:max-w-[53rem]">
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="w-4 h-4" />
            <span>{saving ? '保存中...' : '保存配置'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
