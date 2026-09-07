import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { CategoryTreeNode, SiteInfo } from '../api';
import { applyTheme, getInitialTheme } from '../utils/theme';
import { Footer } from './Footer';
import { Header } from './Header';
import type { PublicOutletContext } from './publicLayoutContext';

const SearchModal = lazy(() => import('./SearchModal').then((module) => ({ default: module.SearchModal })));

export const PublicLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [darkMode, setDarkMode] = useState(() => getInitialTheme() === 'dark');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [tocItems, setTocItems] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [currentDocTitle, setCurrentDocTitle] = useState<string>('');

  const isDocumentRoute = location.pathname.startsWith('/docs/');

  useEffect(() => {
    applyTheme(darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const controller = new AbortController();
    api.getSiteInfo(controller.signal).then((info) => {
      if (!controller.signal.aborted) setSiteInfo(info);
    }).catch(() => undefined);
    api.getKnowledgeTree(controller.signal).then((treeData) => {
      if (!controller.signal.aborted) setTree(treeData || []);
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isSearchOpen]);

  const toggleTheme = () => {
    const next = !darkMode;
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDarkMode(next);
  };

  const selectDocument = (documentSlug: string) => {
    navigate(`/docs/${encodeURIComponent(documentSlug)}`);
  };

  const handleSelectHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(id);
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`);
    }
  }, []);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const outletContext = useMemo(() => ({
    siteInfo,
    tree,
    openSearch,
    tocItems,
    setTocItems,
    activeHeadingId,
    setActiveHeadingId,
    onSelectHeading: handleSelectHeading,
    currentDocTitle,
    setCurrentDocTitle,
  } satisfies PublicOutletContext), [siteInfo, tree, openSearch, tocItems, activeHeadingId, handleSelectHeading, currentDocTitle]);

  return (
    <div className="cloud-doc-surface flex min-h-screen flex-col text-text-secondary">
      <Header
        siteInfo={siteInfo}
        darkMode={darkMode}
        showSidebarToggle={false}
        onToggleDarkMode={toggleTheme}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleSidebar={() => undefined}
      />

      <div
        className={`mx-auto flex w-full flex-1 ${
          isDocumentRoute
            ? 'w-full items-start'
            : 'w-full'
        }`}
      >
        <Outlet context={outletContext} />
      </div>

      <Footer siteInfo={siteInfo} />

      {isSearchOpen && (
        <Suspense fallback={null}>
          <SearchModal
            isOpen
            onClose={() => setIsSearchOpen(false)}
            onSelectDocument={selectDocument}
          />
        </Suspense>
      )}
    </div>
  );
};
