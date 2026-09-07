import { StrictMode, useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from 'react-router-dom';
import type { DocDetailData } from '../api';
import { DocViewer } from './DocViewer';
import { PublicLayout } from './PublicLayout';
import type { PublicOutletContext } from './publicLayoutContext';

vi.mock('../api', () => ({ api: {
  getSiteInfo: vi.fn().mockResolvedValue(null),
  getKnowledgeTree: vi.fn().mockResolvedValue([]),
} }));

const documentData = (content = '# First\n\n## Second', id = 1, title = 'Document'): DocDetailData => ({
  document: {
    id, title, slug: `doc-${id}`, content, excerpt: '', cover: '', status: 'published',
    category_id: 1, author_id: 1, sort_order: 0, is_pinned: false, views: 0,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  },
});

const observers: { callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn> }[] = [];
let scrolls: { element: Element; options: ScrollIntoViewOptions }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  window.history.replaceState(null, '', '/docs/doc-1');
  observers.length = 0;
  scrolls = [];
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) { this.callback = callback; observers.push(this); }
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: function (this: Element, options: ScrollIntoViewOptions) { scrolls.push({ element: this, options }); },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  window.history.replaceState(null, '', '/');
});

const tick = async (ms = 150) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const tocIds = () => Array.from(screen.getByTestId('desktop-toc').querySelectorAll<HTMLAnchorElement>('a')).map((link) => link.dataset.tocId);
const activeId = () => screen.queryByTestId('desktop-toc')?.querySelector<HTMLElement>('[aria-current="location"]')?.dataset.tocId;
const headingScrolls = () => scrolls.filter(({ options }) => options.block === 'start');
const emitHeading = (id: string) => {
  const observer = observers.at(-1)!;
  act(() => observer.callback([
    { target: document.getElementById(id)!, isIntersecting: true, boundingClientRect: new DOMRect(0, 20, 100, 20),
      intersectionRatio: 1, intersectionRect: new DOMRect(), rootBounds: null, time: 0 },
  ], observer as unknown as IntersectionObserver));
};

const renderViewer = (data: DocDetailData | null = documentData(), context?: PublicOutletContext) => {
  const element = (value: DocDetailData | null, loading = false) => (
    <MemoryRouter><Routes><Route element={<Outlet context={context} />}>
      <Route path="*" element={<DocViewer data={value} loading={loading} />} />
    </Route></Routes></MemoryRouter>
  );
  const view = render(element(data));
  return { ...view, switchDocument: (value: DocDetailData | null, loading = false) => view.rerender(element(value, loading)) };
};

describe('DocViewer TOC lifecycle', () => {
  it('keeps the fixed title before and after delayed heading collection', async () => {
    renderViewer();
    expect(tocIds()).toEqual(['doc-title']);
    expect(activeId()).toBe('doc-title');
    await tick();
    expect(tocIds()).toEqual(['doc-title', 'first', 'second']);
    expect(activeId()).toBe('doc-title');
  });

  it.each([
    ['first', '# First', 'first'],
    [encodeURIComponent('中文标题'), '# 中文标题', '中文标题'],
    ['kept-heading', '<div><h1 id="kept-heading">历史标题</h1></div>', 'kept-heading'],
    [encodeURIComponent('heading-2-重复标题'), '<div><h1>开头</h1><h2>重复标题</h2><h2>重复标题</h2></div>', 'heading-2-重复标题'],
  ])('restores hash %s after headings become available', async (hash, content, id) => {
    window.history.replaceState(null, '', `/docs/doc-1#${hash}`);
    renderViewer(documentData(content));
    expect(tocIds()).toEqual(['doc-title']);
    await tick();
    await tick(20);
    expect(activeId()).toBe(id);
    expect(headingScrolls().some(({ element, options }) => element.id === id && options.behavior === 'auto')).toBe(true);
  });

  it('ignores nonexistent and malformed hash targets', async () => {
    window.history.replaceState(null, '', '/docs/doc-1#%E0%A4%A');
    renderViewer();
    await tick();
    expect(activeId()).toBe('doc-title');
    expect(headingScrolls()).toHaveLength(0);
    window.history.replaceState(null, '', '/docs/doc-1#missing');
    fireEvent(window, new Event('hashchange'));
    await tick(20);
    expect(headingScrolls()).toHaveLength(0);
  });

  it('observes headings, updates active without rebuilding, and disconnects on unmount', async () => {
    const view = renderViewer();
    await tick();
    const count = observers.length;
    const observer = observers.at(-1)!;
    expect(observer.observe.mock.calls.map(([node]) => node.id)).toEqual(['doc-title', 'first', 'second']);
    emitHeading('second');
    expect(activeId()).toBe('second');
    expect(observers).toHaveLength(count);
    expect(window.location.hash).toBe('');
    view.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it('preserves title-only TOC and supports an actually empty TOC', async () => {
    const view = renderViewer(documentData('Plain paragraph'));
    await tick();
    expect(tocIds()).toEqual(['doc-title']);
    expect(activeId()).toBe('doc-title');
    view.unmount();
    renderViewer(documentData('', 2, ''));
    await tick();
    expect(screen.queryByTestId('desktop-toc')).toBeNull();
  });

  it('synchronizes body headings, title and clicked heading to the outlet', async () => {
    const context: PublicOutletContext = { siteInfo: null, tree: [], openSearch: vi.fn(),
      setTocItems: vi.fn(), setCurrentDocTitle: vi.fn(), setActiveHeadingId: vi.fn() };
    renderViewer(documentData(), context);
    await tick();
    expect(context.setCurrentDocTitle).toHaveBeenLastCalledWith('Document');
    expect(context.setTocItems).toHaveBeenLastCalledWith([
      { id: 'first', text: 'First', level: 2 }, { id: 'second', text: 'Second', level: 3 },
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'Second' }));
    expect(activeId()).toBe('second');
    expect(context.setActiveHeadingId).toHaveBeenLastCalledWith('second');
    expect(window.location.hash).toBe('#second');
  });

  it('mirrors hash restoration to the outlet, not only the local TOC', async () => {
    const setActiveHeadingId = vi.fn();
    window.history.replaceState(null, '', '/docs/doc-1#second');
    renderViewer(documentData(), { siteInfo: null, tree: [], openSearch: vi.fn(), setActiveHeadingId });
    await tick();
    await tick(20);
    expect(activeId()).toBe('second');
    expect(setActiveHeadingId).toHaveBeenLastCalledWith('second');
  });

  it('resets active and removes stale TOC immediately when switching documents', async () => {
    const setActiveHeadingId = vi.fn();
    const view = renderViewer(documentData(), { siteInfo: null, tree: [], openSearch: vi.fn(), setActiveHeadingId });
    await tick();
    emitHeading('second');
    expect(activeId()).toBe('second');
    const oldObserver = observers.at(-1)!;
    view.switchDocument(documentData('# New section', 2, 'Document B'));
    expect(tocIds()).toEqual(['doc-title']);
    expect(activeId()).toBe('doc-title');
    expect(setActiveHeadingId).toHaveBeenLastCalledWith('doc-title');
    expect(oldObserver.disconnect).toHaveBeenCalledOnce();
    await tick();
    expect(tocIds()).toEqual(['doc-title', 'new-section']);
    expect(observers.at(-1)!.observe.mock.calls.map(([node]) => node.id)).toEqual(['doc-title', 'new-section']);
  });

  it('rebinds identical-content documents to new DOM nodes after a loading gap', async () => {
    const view = renderViewer();
    await tick();
    emitHeading('second');
    const oldNode = document.getElementById('second');
    const oldObserver = observers.at(-1)!;
    view.switchDocument(null);
    await tick(0);
    view.switchDocument(documentData('# First\n\n## Second', 2));
    await tick();
    expect(activeId()).toBe('doc-title');
    expect(document.getElementById('second')).not.toBe(oldNode);
    expect(oldObserver.disconnect).toHaveBeenCalledOnce();
    expect(observers.at(-1)!.observe).toHaveBeenCalledWith(document.getElementById('second'));
  });

  it('clears the outlet active and TOC when the document disappears', async () => {
    const setActiveHeadingId = vi.fn();
    const setTocItems = vi.fn();
    const view = renderViewer(documentData(), { siteInfo: null, tree: [], openSearch: vi.fn(), setActiveHeadingId, setTocItems });
    await tick();
    emitHeading('second');
    view.switchDocument(null);
    expect(screen.queryByTestId('desktop-toc')).toBeNull();
    expect(setActiveHeadingId).toHaveBeenLastCalledWith('');
    expect(setTocItems).toHaveBeenLastCalledWith([]);
  });

  it('restores a hash once, then lets later intersections win without restoring again', async () => {
    window.history.replaceState(null, '', '/docs/doc-1#second');
    renderViewer();
    await tick();
    await tick(20);
    expect(headingScrolls()).toHaveLength(1);
    const count = observers.length;
    emitHeading('first');
    await tick();
    expect(activeId()).toBe('first');
    expect(observers).toHaveLength(count);
    expect(headingScrolls()).toHaveLength(1);
    expect(window.location.hash).toBe('#second');
  });

  it('restores doc-title and history hashes with the existing scroll semantics', async () => {
    window.history.replaceState(null, '', '/docs/doc-1#doc-title');
    renderViewer();
    await tick();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
    window.history.replaceState(null, '', '/docs/doc-1#second');
    fireEvent(window, new Event('popstate'));
    await tick(20);
    expect(activeId()).toBe('second');
    expect(headingScrolls().at(-1)?.options).toEqual({ behavior: 'smooth', block: 'start' });
    fireEvent.click(screen.getByRole('link', { name: 'Document' }));
    expect(activeId()).toBe('doc-title');
    expect(window.location.hash).toBe('#doc-title');
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('keeps duplicate-title suppression without selecting the first body heading by default', async () => {
    renderViewer(documentData('# Document\n\n## Second'));
    await tick();
    expect(tocIds()).toEqual(['document', 'second']);
    // The fixed header is still the initial position, even when its TOC row is suppressed.
    expect(activeId()).toBeUndefined();
    emitHeading('document');
    expect(activeId()).toBe('document');
  });

  it('ignores late callbacks from an observer disconnected during document switching', async () => {
    const view = renderViewer();
    await tick();
    const previous = observers.at(-1)!;
    const previousTarget = document.getElementById('second')!;
    view.switchDocument(documentData('# New section', 2));
    await tick();
    emitHeading('new-section');
    act(() => previous.callback([
      { target: previousTarget, isIntersecting: true, boundingClientRect: new DOMRect(0, 10, 100, 20),
        intersectionRatio: 1, intersectionRect: new DOMRect(), rootBounds: null, time: 0 },
    ], previous as unknown as IntersectionObserver));
    expect(activeId()).toBe('new-section');
  });

  it('cancels a pending heading restore when a newer hash points to doc-title', async () => {
    renderViewer();
    await tick();
    window.history.replaceState(null, '', '/docs/doc-1#second');
    fireEvent(window, new Event('hashchange'));
    window.history.replaceState(null, '', '/docs/doc-1#doc-title');
    fireEvent(window, new Event('hashchange'));
    await tick(20);
    expect(activeId()).toBe('doc-title');
    expect(headingScrolls()).toHaveLength(0);
  });

  it('does not overwrite a TOC click with an older queued hash restoration', async () => {
    renderViewer();
    await tick();
    window.history.replaceState(null, '', '/docs/doc-1#second');
    fireEvent(window, new Event('hashchange'));
    fireEvent.click(screen.getByRole('link', { name: 'First' }));
    await tick(20);
    expect(activeId()).toBe('first');
    expect(headingScrolls().map(({ element }) => element.id)).toEqual(['first']);
  });

  it('restores after lazy math rendering supplies the heading DOM', async () => {
    window.history.replaceState(null, '', '/docs/doc-1#formula');
    renderViewer(documentData('# Formula\n\n$E = mc^2$'));
    expect(document.getElementById('formula')).toBeNull();
    await act(async () => { await import('./markdownMath'); });
    await tick();
    await tick(20);
    expect(activeId()).toBe('formula');
    expect(headingScrolls().map(({ element }) => element.id)).toEqual(['formula']);
  });

  it('cleans up hash listeners and pending restoration on unmount', async () => {
    const view = renderViewer();
    await tick();
    window.history.replaceState(null, '', '/docs/doc-1#second');
    fireEvent(window, new Event('hashchange'));
    view.unmount();
    fireEvent(window, new Event('popstate'));
    await tick();
    expect(headingScrolls()).toHaveLength(0);
  });

  it('recollects headings after loading temporarily hides the same document', async () => {
    const data = documentData();
    const view = renderViewer(data);
    await tick();
    emitHeading('second');
    const oldObserver = observers.at(-1)!;
    view.switchDocument(data, true);
    expect(screen.queryByTestId('desktop-toc')).toBeNull();
    expect(oldObserver.disconnect).toHaveBeenCalledOnce();
    view.switchDocument(data);
    expect(activeId()).toBe('doc-title');
    await tick();
    expect(tocIds()).toEqual(['doc-title', 'first', 'second']);
    expect(observers.at(-1)!.observe).toHaveBeenCalledWith(document.getElementById('second'));
  });

  it('cancels stale TOC timers during rapid document switching', async () => {
    const setTocItems = vi.fn();
    const view = renderViewer(documentData(), { siteInfo: null, tree: [], openSearch: vi.fn(), setTocItems });
    await tick(60);
    view.switchDocument(documentData('# New section', 2));
    await tick(65);
    expect(tocIds()).toEqual(['doc-title']);
    expect(setTocItems.mock.calls.some(([items]) => items.some((item: { id: string }) => item.id === 'first'))).toBe(false);
    await tick(60);
    expect(tocIds()).toEqual(['doc-title', 'new-section']);
  });

  it('keeps one live observer and one hash scroll through StrictMode effect replay', async () => {
    window.history.replaceState(null, '', '/docs/doc-1#second');
    const view = render(<StrictMode><MemoryRouter><DocViewer data={documentData()} loading={false} /></MemoryRouter></StrictMode>);
    await tick();
    await tick(20);
    expect(activeId()).toBe('second');
    expect(headingScrolls()).toHaveLength(1);
    expect(observers.filter((observer) => observer.disconnect.mock.calls.length === 0)).toHaveLength(1);
    view.unmount();
    expect(observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
  });
});

describe('PublicLayout outlet contract', () => {
  it('keeps context stable across theme changes and publishes fresh TOC state', async () => {
    const contexts: PublicOutletContext[] = [];
    const Probe = () => {
      const context = useOutletContext<PublicOutletContext>();
      useEffect(() => { contexts.push(context); });
      return <button onClick={() => {
        context.setActiveHeadingId?.('fresh');
        context.setTocItems?.([{ id: 'fresh', text: 'Fresh heading', level: 2 }]);
        context.setCurrentDocTitle?.('Fresh title');
      }}>Set heading</button>;
    };
    render(<MemoryRouter><Routes><Route element={<PublicLayout />}>
      <Route path="*" element={<Probe />} />
    </Route></Routes></MemoryRouter>);
    await tick(0);
    const before = contexts.at(-1)!;
    fireEvent.click(screen.getByRole('button', { name: /切换.*模式/ }));
    expect(contexts.at(-1)).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Set heading' }));
    expect(contexts.at(-1)?.activeHeadingId).toBe('fresh');
    expect(contexts.at(-1)?.tocItems).toEqual([{ id: 'fresh', text: 'Fresh heading', level: 2 }]);
    expect(contexts.at(-1)?.currentDocTitle).toBe('Fresh title');
    expect(contexts.at(-1)?.openSearch).toBe(before.openSearch);
    expect(contexts.at(-1)?.onSelectHeading).toBe(before.onSelectHeading);
  });

  it('does not rebind observers or restore hashes when real outlet state changes', async () => {
    const Viewer = () => {
      const context = useOutletContext<PublicOutletContext>();
      return <><output data-testid="outlet-active">{context.activeHeadingId}</output>
        <DocViewer data={documentData()} loading={false} /></>;
    };
    window.history.replaceState(null, '', '/docs/doc-1#second');
    render(<MemoryRouter initialEntries={['/docs/doc-1']}><Routes><Route element={<PublicLayout />}>
      <Route path="*" element={<Viewer />} />
    </Route></Routes></MemoryRouter>);
    await tick();
    await tick(20);
    expect(screen.getByTestId('outlet-active').textContent).toBe('second');
    const count = observers.length;
    emitHeading('first');
    fireEvent.click(screen.getByRole('button', { name: /切换.*模式/ }));
    await tick(300);
    expect(activeId()).toBe('first');
    expect(screen.getByTestId('outlet-active').textContent).toBe('first');
    expect(observers).toHaveLength(count);
    expect(headingScrolls()).toHaveLength(1);
  });
});
