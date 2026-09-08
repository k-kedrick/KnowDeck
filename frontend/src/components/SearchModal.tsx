import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Search, X, FileText, Folder, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { SearchResult } from '../api';
import { IconButton } from './ui/IconButton';
import { useAuth } from '../auth/AuthContext';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (slug: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelectDocument }) => {
  const [query, setQuery] = useState('');
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const sanitizeSnippet = (snippet: string) =>
    DOMPurify.sanitize(snippet, {
      ALLOWED_TAGS: ['mark'],
      ALLOWED_ATTR: ['class'],
    });

  // Hotkey handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      } else if (isOpen && results.length && e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((index) => (index + 1) % results.length);
      } else if (isOpen && results.length && e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((index) => (index - 1 + results.length) % results.length);
      } else if (isOpen && results[selectedIndex] && e.key === 'Enter') {
        e.preventDefault();
        onSelectDocument(results[selectedIndex].slug);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelectDocument, results, selectedIndex]);

  // Focus input on modal open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => { setResults([]); setSelectedIndex(0); }, [user?.id]);

  // Search logic with debounce
  useEffect(() => {
    if (!query.trim()) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query.trim(), controller.signal);
        if (controller.signal.aborted) return;
        setResults(data || []);
        setSelectedIndex(0);
      } catch (err) {
        if (!controller.signal.aborted) console.error('Search failed:', err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, user?.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="搜索知识库"
        className="relative z-10 flex max-h-[72vh] w-full max-w-2xl flex-col overflow-hidden rounded-ds-lg border border-border-subtle bg-surface-elevated shadow-modal transition-all"
      >
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-slate-200/80 dark:border-slate-800">
          <Search className="h-5 w-5 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              const nextQuery = e.target.value;
              setQuery(nextQuery);
              setSelectedIndex(0);
              if (!nextQuery.trim()) {
                setResults([]);
                setLoading(false);
              }
            }}
            placeholder="搜索知识库文档内容或关键字..."
            aria-label="搜索知识库文档内容或关键字"
            className="w-full px-3 py-3.5 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none text-sm sm:text-base"
          />
          {loading && <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin text-brand" />}
          <IconButton
            label="关闭搜索"
            size="sm"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
              输入关键词开始全局快速检索
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
              未找到与 <span className="text-blue-600 font-medium dark:text-blue-400">"{query}"</span> 相关的文档
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  onSelectDocument(item.slug);
                  onClose();
                }}
                className={`group w-full rounded-xl border p-3 text-left transition-colors ${
                  selectedIndex === idx
                    ? 'border-slate-300/80 bg-slate-100/90 dark:border-slate-700 dark:bg-slate-800'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm sm:text-base">
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    <span>{item.title}</span>
                  </div>
                  {item.category_name && (
                    <span className="flex items-center space-x-1 rounded-ds-sm bg-surface-subtle px-2 py-0.5 text-xs text-text-tertiary">
                      <Folder className="w-3 h-3 text-amber-500" />
                      <span>{item.category_name}</span>
                    </span>
                  )}
                </div>
                {item.snippet && (
                  <p
                    className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pl-6 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeSnippet(item.snippet) }}
                  />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface-subtle px-4 py-2.5 text-xs text-text-tertiary">
          <span>提示：按 ESC 关闭 · ↑↓ 选择 · Enter 确认</span>
          <span>匹配结果上限 20 条</span>
        </div>
      </div>
    </div>
  );
};
