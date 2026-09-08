import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import type { User } from '../api';

interface UserDropdownProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const UserDropdown: React.FC<UserDropdownProps> = ({
  user,
  onLogout,
  darkMode,
  onToggleDarkMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayName = user.nickname?.trim() || user.username;
  const initial = displayName.slice(0, 1).toUpperCase();
  const isAdmin = user.role === 'admin';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="打开用户菜单"
        className="group flex items-center gap-2 rounded-full border border-border-default bg-surface px-1.5 py-1 text-xs font-semibold text-text-primary shadow-xs transition-all duration-150 hover:border-brand/40 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-brand to-indigo-500 font-bold text-white shadow-xs">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <span className="hidden max-w-[120px] truncate text-xs font-semibold text-text-primary sm:inline-block">
          {displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-tertiary transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-brand' : 'group-hover:text-text-secondary'
          }`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] w-64 origin-top-right rounded-xl border border-border-default bg-surface shadow-2xl p-1.5 transition-all animate-in fade-in zoom-in-95 duration-100"
        >
          {/* User Profile Header Card */}
          <div className="border-b border-border-subtle bg-surface-subtle/60 rounded-lg p-2.5 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-brand to-indigo-500 font-bold text-white shadow-xs">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-xs font-bold text-text-primary">
                    {displayName}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      isAdmin
                        ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border border-blue-500/30 bg-blue-500/10 text-brand'
                    }`}
                  >
                    {isAdmin ? '管理员' : '成员'}
                  </span>
                </div>
                <p className="truncate text-[11px] text-text-tertiary mt-0.5">
                  @{user.username}
                </p>
              </div>
            </div>
          </div>

          {/* Action Links & Operations */}
          <div className="space-y-0.5 py-1">
            {isAdmin && (
              <Link
                to="/wang"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-brand-soft hover:text-brand"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>进入管理控制台</span>
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleDarkMode();
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
            >
              <div className="flex items-center gap-2.5">
                {darkMode ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-text-tertiary" />
                )}
                <span>{darkMode ? '切换为亮色模式' : '切换为暗色模式'}</span>
              </div>
              <span className="text-[10px] font-medium text-text-tertiary">
                {darkMode ? 'Dark' : 'Light'}
              </span>
            </button>
          </div>

          {/* Logout Divider & Action */}
          <div className="border-t border-border-subtle pt-1 mt-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
