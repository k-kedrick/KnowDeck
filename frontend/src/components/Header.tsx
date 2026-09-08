import React, { useState } from 'react';
import { Search, Sun, Moon, BookOpen, Layers, Menu, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { SiteInfo } from '../api';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

interface HeaderProps {
  siteInfo: SiteInfo | null;
  darkMode: boolean;
  showSidebarToggle: boolean;
  onToggleDarkMode: () => void;
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  siteInfo,
  darkMode,
  showSidebarToggle,
  onToggleDarkMode,
  onOpenSearch,
  onToggleSidebar,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  const navLinkClass = (isActive: boolean) =>
    `inline-flex min-h-9 items-center rounded-ds-md px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${
      isActive
        ? 'bg-brand-soft text-brand'
        : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
    }`;

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border-subtle bg-surface/95 backdrop-blur-md transition-colors">
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
            className="group flex min-w-0 items-center gap-2 rounded-ds-md p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand sm:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-md bg-brand text-white transition-colors group-hover:bg-brand-hover">
              {siteInfo?.site_logo ? (
                <img
                  src={siteInfo.site_logo}
                  alt="Logo"
                  decoding="async"
                  className="h-full w-full rounded-ds-md object-cover"
                />
              ) : (
                <BookOpen className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-text-primary sm:text-lg">
                {siteInfo?.site_name || '知识库'}
              </span>
              {siteInfo?.site_subtitle && (
                <p className="hidden truncate text-xs text-text-tertiary lg:block">
                  {siteInfo.site_subtitle}
                </p>
              )}
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav aria-label="主导航" className="ml-3 hidden items-center gap-1 md:flex lg:ml-6">
            <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
              首页
            </NavLink>
            <NavLink to="/blog" className={({ isActive }) => navLinkClass(isActive)}>
              文章
            </NavLink>
          </nav>
        </div>

        {/* Center/Right: Quick Search Trigger */}
        <div className="hidden max-w-xs flex-1 sm:block lg:max-w-sm xl:max-w-md">
          <Button
            variant="secondary"
            onClick={onOpenSearch}
            className="w-full justify-between px-3 font-normal text-text-tertiary hover:border-brand hover:text-text-secondary"
          >
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span className="text-sm">搜索知识库...</span>
            </div>
            <kbd className="hidden items-center rounded-ds-sm border border-border-subtle bg-surface-subtle px-2 py-0.5 font-mono text-xs font-medium text-text-tertiary lg:inline-flex">
              Ctrl K
            </kbd>
          </Button>
        </div>

        {/* Right Actions: Theme Toggle, Search Icon (Mobile), Mobile Menu */}
        <div className="flex items-center gap-1.5">
          <IconButton
            label="搜索"
            onClick={onOpenSearch}
            className="sm:hidden"
          >
            <Search className="h-5 w-5" />
          </IconButton>

          {!loading && (user ? <><span className="text-sm font-semibold">{user.username}</span><button type="button" onClick={logout} className="text-sm">退出登录</button></> : <><Link to="/login" className="text-sm">登录</Link><Link to="/register" className="text-sm">注册</Link></>)}
          <IconButton
            label={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
            onClick={onToggleDarkMode}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </IconButton>

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
