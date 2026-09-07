import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  FileText,
  FolderTree,
  Tag as TagIcon,
  Image as ImageIcon,
  Settings,
  LogOut,
  ExternalLink,
  BookOpen,
  User as UserIcon,
	Users,
  Menu,
  X,
} from 'lucide-react';
import { api } from '../../api';
import type { User } from '../../api';

interface AuthContext {
  user: User | null;
}

export const AdminLayout: React.FC = () => {
  const { user } = useOutletContext<AuthContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditorAdminNavOpen, setIsEditorAdminNavOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('kb_token');
      navigate('/wang/login', { replace: true });
    }
  };

  const navItems = [
    { to: '/wang/documents', label: '文档管理', icon: FileText, end: true },
    { to: '/wang/categories', label: '分类管理', icon: FolderTree },
    { to: '/wang/tags', label: '标签管理', icon: TagIcon },
    { to: '/wang/media', label: '媒体资源库', icon: ImageIcon },
    { to: '/wang/settings', label: '系统配置', icon: Settings },
	{ to: '/wang/users', label: '用户管理', icon: Users },
  ];
  const isEditorWorkspace = /^\/wang\/documents\/(?:new|\d+)$/.test(location.pathname);
  const currentPage = isEditorWorkspace
    ? '文档编辑'
    : navItems.find((item) => location.pathname.startsWith(item.to))?.label || '管理控制台';

  React.useEffect(() => {
    if (!isEditorWorkspace || !isEditorAdminNavOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsEditorAdminNavOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorAdminNavOpen, isEditorWorkspace]);

  return (
    <div className={`admin-shell cloud-doc-surface flex flex-col font-sans text-text-secondary ${isEditorWorkspace ? 'admin-editor-route-shell' : 'min-h-screen'}`}>
      {/* Admin Header */}
      <header className="sticky top-0 z-30 h-14 border-b border-border-subtle bg-surface/95 px-3 backdrop-blur-md sm:px-4">
        <div className={`${isEditorWorkspace ? 'layout-workspace' : 'layout-shell'} flex h-full items-center justify-between gap-2`}>
        <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
          {isEditorWorkspace && (
            <button
              type="button"
              onClick={() => setIsEditorAdminNavOpen((open) => !open)}
              className="admin-editor-nav-toggle flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-md text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
              aria-label={isEditorAdminNavOpen ? '关闭管理导航' : '打开管理导航'}
              aria-expanded={isEditorAdminNavOpen}
            >
              {isEditorAdminNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-ds-md bg-brand font-bold text-white">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="truncate text-sm font-semibold tracking-tight text-text-primary sm:text-base">
            知识库 · 控制台
          </span>
          <span className="hidden text-text-tertiary sm:inline" aria-hidden="true">/</span>
          <span className="hidden truncate text-sm font-medium text-text-secondary sm:inline">{currentPage}</span>
        </div>

        <div className="flex shrink-0 items-center space-x-1 sm:space-x-4">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            aria-label="在新标签页打开前台知识库"
            className="flex min-h-9 items-center space-x-1 rounded-ds-md px-2.5 py-1.5 text-sm font-medium text-text-tertiary transition-colors hover:bg-surface-subtle hover:text-brand"
          >
            <span className="hidden lg:inline">返回前台阅读</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

          <div className="flex items-center space-x-2 text-sm font-medium text-text-secondary">
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <UserIcon className="w-4 h-4" />
            </div>
            <span className="hidden md:inline">{user?.nickname || user?.username || '管理员'}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex min-h-9 items-center space-x-1 rounded-ds-md px-2.5 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
            title="退出登录"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
        </div>
      </header>

      {/* Main Container */}
      <div className={`${isEditorWorkspace ? 'layout-workspace admin-editor-route-layout' : 'layout-shell'} flex flex-1 flex-col gap-4 px-3 py-4 md:px-4 md:py-5 lg:flex-row lg:gap-6 xl:px-5`}>
        {isEditorWorkspace && isEditorAdminNavOpen && (
          <button
            type="button"
            className="admin-editor-nav-backdrop"
            onClick={() => setIsEditorAdminNavOpen(false)}
            aria-label="关闭管理导航"
          />
        )}
        {/* Left Admin Sidebar */}
        <aside
          data-drawer-open={isEditorAdminNavOpen ? 'true' : 'false'}
          className={`static flex h-auto w-full flex-shrink-0 flex-col border-b border-border-subtle pb-3 lg:sticky lg:top-[4.75rem] lg:h-[calc(100vh-5.75rem)] lg:border-b-0 lg:border-r lg:pr-4 ${isEditorWorkspace ? 'admin-editor-global-nav lg:w-52' : 'lg:w-56'}`}
        >
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:block lg:space-y-1">
            <div className="col-span-2 px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary sm:col-span-3 lg:block">
              内容工作台
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setIsEditorAdminNavOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-10 items-center space-x-3 rounded-ds-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-soft text-brand font-semibold'
                        : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

        </aside>

        {/* Right Admin Workstation */}
        <main
          data-workspace={isEditorWorkspace ? 'wide' : 'standard'}
          className={`flex min-w-0 flex-1 flex-col ${isEditorWorkspace ? 'admin-workspace-wide min-h-0 overflow-hidden p-3 sm:p-4' : 'admin-workspace-standard py-1 md:px-2'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
