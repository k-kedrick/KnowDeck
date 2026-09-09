import React, { useState } from 'react';
import { Search, Sun, Moon, BookOpen, Layers, Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import type { SiteInfo } from '../api';
import { Button } from './ui/Button';
import { UserDropdown } from './UserDropdown';
import { IconButton } from './ui/IconButton';

interface HeaderProps {
  siteInfo: SiteInfo | null;
  darkMode: boolean;
  showSearch?: boolean;
  showSidebarToggle: boolean;
  onToggleDarkMode: () => void;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  siteInfo,
  darkMode,
  showSearch = true,
  showSidebarToggle,
  onToggleDarkMode,
  onOpenSearch,
  onToggleSidebar,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  const navLinkClass = (isActive: boolean) =>
    `inline-flex min-h-9 items-center rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
      isActive
        ? 'bg-blue-50 text-blue-700 shadow-xs dark:bg-blue-950/60 dark:text-blue-300 font-bold'
        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl transition-colors dark:border-slate-800/80 dark:bg-slate-900/85">
      <div className="layout-shell page-gutter flex h-full items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand & Mobile Sidebar Toggle */}
        <div className="flex min-w-0 items-center gap-3">
          {showSidebarToggle && (
            <IconButton
              label="打开文档导航"
              onClick={onToggleSidebar}
              size="sm"
              className="2xl:hidden"
            >
              <Layers className="w-5 h-5" />
            </IconButton>
          )}

          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2.5 rounded-xl p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand sm:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 transition-all group-hover:scale-105 group-hover:shadow-blue-500/30">
              {siteInfo?.site_logo ? (
                <img
                  src={siteInfo.site_logo}
                  alt="Logo"
                  decoding="async"
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <BookOpen className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                {siteInfo?.site_name || '知识库'}
              </span>
              {siteInfo?.site_subtitle && (
                <p className="hidden truncate text-xs text-slate-400 lg:block">
                  {siteInfo.site_subtitle}
                </p>
              )}
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav aria-label="主导航" className="ml-3 hidden items-center gap-1.5 md:flex lg:ml-6">
            <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
              首页
            </NavLink>
            <NavLink to="/blog" className={({ isActive }) => navLinkClass(isActive)}>
              文章
            </NavLink>
          </nav>
        </div>

        {/* Center/Right: Quick Search Trigger */}
        {showSearch && (
          <div className="hidden max-w-xs flex-1 sm:block lg:max-w-sm xl:max-w-md">
            <Button
              variant="secondary"
              onClick={onOpenSearch}
              className="w-full justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 font-normal text-slate-400 shadow-xs hover:border-blue-400 hover:bg-white hover:text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 transition-all"
            >
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <span className="text-sm">搜索知识库...</span>
              </div>
              <kbd className="hidden items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900 lg:inline-flex shadow-2xs">
                Ctrl K
              </kbd>
            </Button>
          </div>
        )}

        {/* Right Actions: Theme Toggle, Search Icon (Mobile), User Dropdown, Mobile Menu */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <IconButton
              label="搜索"
              onClick={onOpenSearch}
              className="sm:hidden"
            >
              <Search className="h-5 w-5" />
            </IconButton>
          )}

          {!loading && (
            user ? (
              <UserDropdown
                user={user}
                onLogout={logout}
                darkMode={darkMode}
                onToggleDarkMode={onToggleDarkMode}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="hidden rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.98] sm:inline-flex"
                >
                  注册
                </Link>
              </div>
            )
          )}

          {!user && (
            <IconButton
              label={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
              onClick={onToggleDarkMode}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </IconButton>
          )}

          <IconButton
            label="切换主导航"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            className="md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </IconButton>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <nav
          aria-label="移动端主导航"
          className="absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-ds-lg border border-border-subtle bg-surface-elevated p-3 shadow-dropdown md:hidden"
        >
          <NavLink
            to="/"
            end
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `block ${navLinkClass(isActive)}`}
          >
            首页
          </NavLink>
          <NavLink
            to="/blog"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) => `mt-1 block ${navLinkClass(isActive)}`}
          >
            文章
          </NavLink>
        </nav>
      )}
    </header>
  );
};
