import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  LayoutDashboard,
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

  interface NavItem {
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    end?: boolean;
  }

  const navItems: NavItem[] = [
    { to: '/wang/dashboard', label: '控制台概览', icon: LayoutDashboard },
    { to: '/wang/documents', label: '文档管理', icon: FileText },
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
    <div className={`admin-shell relative cloud-doc-surface flex flex-col font-sans text-text-secondary ${isEditorWorkspace ? 'admin-editor-route-shell' : 'min-h-screen'}`}>
      {/* Soft Ambient Light for Admin */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-full -translate-x-1/2 max-w-7xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl dark:from-blue-600/15 dark:via-indigo-600/5" aria-hidden="true" />

      {/* Admin Header */}
      <header className="sticky top-0 z-30 h-16 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl transition-colors dark:border-slate-800/80 dark:bg-slate-900/85 sm:px-6">
        <div className={`${isEditorWorkspace ? 'layout-workspace' : 'layout-shell'} flex h-full items-center justify-between gap-3`}>
          <div className="flex min-w-0 items-center space-x-3">
            {isEditorWorkspace && (
              <button
                type="button"
                onClick={() => setIsEditorAdminNavOpen((open) => !open)}
                className="admin-editor-nav-toggle flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={isEditorAdminNavOpen ? '关闭管理导航' : '打开管理导航'}
                aria-expanded={isEditorAdminNavOpen}
              >
                {isEditorAdminNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 font-bold text-white shadow-md shadow-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">
              知识库 · 控制台
            </span>
            <span className="hidden text-slate-300 dark:text-slate-700 sm:inline" aria-hidden="true">/</span>
            <span className="hidden truncate text-sm font-semibold text-slate-500 dark:text-slate-400 sm:inline">{currentPage}</span>
          </div>

          <div className="flex shrink-0 items-center space-x-2 sm:space-x-4">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              aria-label="在新标签页打开前台知识库"
              className="flex min-h-9 items-center space-x-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-xs transition-all hover:border-blue-300 hover:bg-white hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="hidden lg:inline">返回前台阅读</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
            </a>

            <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

            <div className="flex items-center space-x-2 rounded-xl bg-slate-100/80 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-[11px] shadow-xs">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <span className="hidden md:inline">{user?.nickname || user?.username || '管理员'}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex min-h-9 items-center space-x-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              title="退出登录"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className={`${isEditorWorkspace ? 'layout-workspace admin-editor-route-layout' : 'layout-shell'} flex flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8 lg:flex-row lg:gap-8`}>
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
          className={`static flex h-auto w-full flex-shrink-0 flex-col border-b border-slate-200/80 pb-4 lg:sticky lg:top-[5.25rem] lg:h-[calc(100vh-6.75rem)] lg:border-b-0 lg:border-r lg:pr-5 dark:border-slate-800/80 ${isEditorWorkspace ? 'admin-editor-global-nav lg:w-56' : 'lg:w-60'}`}
        >
          <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:block lg:space-y-1.5">
            <div className="col-span-2 px-3.5 pb-2.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 sm:col-span-3 lg:block">
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
                    `flex min-h-10 items-center space-x-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/60 dark:text-blue-300 font-bold'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
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
          className={`flex min-w-0 flex-1 flex-col ${isEditorWorkspace ? 'admin-workspace-wide min-h-0 overflow-hidden p-3 sm:p-4' : 'admin-workspace-standard'}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
