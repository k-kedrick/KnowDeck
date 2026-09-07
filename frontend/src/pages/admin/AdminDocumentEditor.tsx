import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save,
  Send,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Clock,
  Check,
  BookOpen,
  ListTree,
  PanelRightClose,
  ExternalLink,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  WrapText,
  X,
} from 'lucide-react';
import { api } from '../../api';
import type { DocumentSaveReq, Category, Media, Tag, DocumentDetail } from '../../api';
import { DocumentVisualEditor } from '../../components/admin/DocumentVisualEditor';
import { TagCombobox } from '../../components/admin/TagCombobox';
import type { TiptapEditorHandle } from '../../components/admin/tiptap/TiptapEditor';
import { detectContentFormat } from '../../components/admin/tiptap/editorContentAdapter';
import { AdminDocTreeSidebar } from '../../components/admin/AdminDocTreeSidebar';
import {
  createNewDocumentDraftPath,
  getDraftKey,
  isValidLocalDraftId,
  localDraftDiffersFromDocument,
  migrateLegacyNewDraft,
  useDocumentDraft,
} from '../../hooks/useDocumentDraft';
import type { LocalDraftData } from '../../hooks/useDocumentDraft';
import { documentSnapshotsEqual } from '../../utils/documentComparison';
import { buildDocumentPayload } from '../../utils/documentPayload';

const EDITOR_ENGINE: 'legacy' | 'tiptap' = import.meta.env.VITE_EDITOR_ENGINE === 'tiptap' ? 'tiptap' : 'legacy';
const TiptapEditor = lazy(() => import('../../components/admin/tiptap/TiptapEditor').then((module) => ({ default: module.TiptapEditor })));

const localDraftMatchesSnapshot = (draft: LocalDraftData, snapshot: LocalDraftData) => documentSnapshotsEqual(draft, snapshot);

const documentSnapshot = (document: DocumentDetail): LocalDraftData => ({
  version: 2,
  id: document.id,
  title: document.title,
  slug: document.slug,
  content: document.content || '',
  excerpt: document.excerpt || '',
  cover: document.cover || '',
  status: document.status,
  categoryId: document.category_id || 0,
  isPinned: Boolean(document.is_pinned),
  tags: document.tags || [],
  updatedAt: Date.now(),
  serverUpdatedAt: document.updated_at,
});

export const AdminDocumentEditor: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDraftId = searchParams.get('draft');
  const [localDraftId] = useState<string | undefined>(() => (
    isEdit ? undefined : migrateLegacyNewDraft(isValidLocalDraftId(requestedDraftId) ? requestedDraftId : undefined)
  ));
  const currentDraftKey = getDraftKey(id, localDraftId);
  const { readDraft, writeDraft, removeDraft } = useDocumentDraft();

  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [excerpt, setExcerpt] = useState<string>('');
  const [cover, setCover] = useState<string>('');
  const [status, setStatus] = useState<string>('draft');
  const [categoryId, setCategoryId] = useState<number>(0);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [tags, setTags] = useState<string[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 🌟 LocalStorage Draft States & Refs
  const [pendingDraft, setPendingDraft] = useState<LocalDraftData | null>(null);
  const [draftHasServerConflict, setDraftHasServerConflict] = useState<boolean>(false);
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null);

  const initialLoadedRef = useRef<boolean>(!isEdit);
  const loadingRef = useRef<boolean>(loading);
  const serverUpdatedAtRef = useRef<string | undefined>(undefined);
  const serverSnapshotRef = useRef<LocalDraftData | null>(null);
  const draftResolutionPendingRef = useRef<boolean>(false);
  const suppressUnmountDraftRef = useRef<boolean>(false);

  const titleRef = useRef(title);
  const slugRef = useRef(slug);
  const contentRef = useRef(content);
  const excerptRef = useRef(excerpt);
  const coverRef = useRef(cover);
  const statusRef = useRef(status);
  const categoryIdRef = useRef(categoryId);
  const isPinnedRef = useRef(isPinned);
  const tagsRef = useRef(tags);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tiptapEditorRef = useRef<TiptapEditorHandle>(null);

  const [uploading, setUploading] = useState<boolean>(false);

  useEffect(() => {
    if (!isEdit && localDraftId && requestedDraftId !== localDraftId) {
      navigate(createNewDocumentDraftPath(localDraftId), { replace: true });
    }
  }, [isEdit, localDraftId, navigate, requestedDraftId]);

  // 🌟 Navigation Sidebar States (Knowledge Base Tree & Live Outline TOC)
  const [showDocTree, setShowDocTree] = useState<boolean>(() => {
    const saved = localStorage.getItem('kb_admin_show_doctree');
    return saved !== null ? saved === 'true' : true;
  });
  const [showToc, setShowToc] = useState<boolean>(() => {
    const saved = localStorage.getItem('kb_admin_show_toc');
    return saved !== null ? saved === 'true' : true;
  });
  const [tocItems, setTocItems] = useState<{ id: string; text: string; level: number }[]>([]);
  const [outlineSearch, setOutlineSearch] = useState<string>('');
  const [outlineWrapText, setOutlineWrapText] = useState<boolean>(true);
  const [showOutlineSearch, setShowOutlineSearch] = useState<boolean>(false);
  const [activeOverlayPanel, setActiveOverlayPanel] = useState<'tree' | 'outline' | null>(null);
  const [showProperties, setShowProperties] = useState<boolean>(false);
  const propertiesTriggerRef = useRef<HTMLButtonElement>(null);
  const propertiesFirstInputRef = useRef<HTMLInputElement>(null);

  const closeProperties = useCallback(() => {
    setShowProperties(false);
    window.requestAnimationFrame(() => propertiesTriggerRef.current?.focus());
  }, []);

  const handlePropertiesToggle = () => {
    if (showProperties) {
      closeProperties();
      return;
    }
    setActiveOverlayPanel(null);
    setShowProperties(true);
  };

  useEffect(() => {
    if (!showProperties) return undefined;
    const frame = window.requestAnimationFrame(() => propertiesFirstInputRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.innerWidth < 1280) closeProperties();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeProperties, showProperties]);

  // Persist sidebar visibility preferences
  useEffect(() => {
    localStorage.setItem('kb_admin_show_doctree', String(showDocTree));
  }, [showDocTree]);

  useEffect(() => {
    localStorage.setItem('kb_admin_show_toc', String(showToc));
  }, [showToc]);

  useEffect(() => {
    const handleResize = () => {
      setActiveOverlayPanel((current) => {
        if (current === 'tree' && window.innerWidth >= 1280) return null;
        if (current === 'outline' && window.innerWidth >= 1600) return null;
        return current;
      });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveOverlayPanel(null);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleTreePanelToggle = () => {
    if (window.innerWidth < 1280) {
      setActiveOverlayPanel((current) => (current === 'tree' ? null : 'tree'));
      return;
    }
    setShowDocTree((current) => !current);
  };

  const handleTreePanelClose = () => {
    if (activeOverlayPanel === 'tree') {
      setActiveOverlayPanel(null);
      return;
    }
    setShowDocTree(false);
  };

  const handleOutlinePanelToggle = () => {
    if (window.innerWidth < 1600) {
      setActiveOverlayPanel((current) => (current === 'outline' ? null : 'outline'));
      return;
    }
    setShowToc((current) => !current);
  };

  const handleOutlinePanelClose = () => {
    if (activeOverlayPanel === 'outline') {
      setActiveOverlayPanel(null);
      return;
    }
    setShowToc(false);
  };

  // 🌟 Live TOC Extraction from Editor Content / DOM
  useEffect(() => {
    if (!content) {
      setTocItems([]);
      return;
    }

    const timer = setTimeout(() => {
      // 1. Scan DOM if in visual or preview mode
      const domHeadings = document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4');
      if (domHeadings.length > 0) {
        const items: { id: string; text: string; level: number }[] = [];
        domHeadings.forEach((h, index) => {
          const text = (h.textContent || '').trim();
          if (!text) return;
          const level = parseInt(h.tagName.substring(1), 10) || 1;
          let id = h.id;
          if (!id) {
            id = `editor-heading-${index}-${text.slice(0, 20).replace(/[^\w\u4e00-\u9fa5]+/g, '-')}`;
            h.id = id;
          }
          items.push({ id, text, level });
        });
        setTocItems(items);
        return;
      }

      // 2. Parse Markdown headings directly from content
      const lines = content.split('\n');
      const items: { id: string; text: string; level: number }[] = [];
      lines.forEach((line, index) => {
        const match = line.match(/^(#{1,4})\s+(.+)$/);
        if (match) {
          const level = match[1].length;
          const text = match[2].replace(/[#*`_~]/g, '').trim();
          if (text) {
            items.push({
              id: `line-h-${index}-${text.slice(0, 20).replace(/[^\w\u4e00-\u9fa5]+/g, '-')}`,
              text,
              level,
            });
          }
        }
      });
      setTocItems(items);
    }, 150);

    return () => clearTimeout(timer);
  }, [content]);

  const handleTocClick = (item: { id: string; text: string }) => {
    let el = document.getElementById(item.id);
    if (!el) {
      const allHeadings = Array.from(
        document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4')
      );
      el = (allHeadings.find((h) => (h.textContent || '').trim() === item.text) as HTMLElement) || null;
    }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-blue-500', 'rounded-lg', 'transition-all');
      setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-blue-500', 'rounded-lg');
      }, 1500);
    }
  };

  // Load editor metadata
  useEffect(() => {
    const loadMetadata = async () => {
      const [categoryResult, tagResult] = await Promise.allSettled([
        api.getAdminCategories(),
        api.getAdminTags(),
      ]);
      if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value || []);
      else console.error('Failed to load editor categories:', categoryResult.reason);
      if (tagResult.status === 'fulfilled') setAvailableTags(tagResult.value || []);
      else console.error('Failed to load editor tags:', tagResult.reason);
      setTagsLoading(false);
    };
    void loadMetadata();
  }, []);

  // 🌟 Check for local draft on new document mount
  useEffect(() => {
    if (!isEdit) {
      initialLoadedRef.current = true;
      const draft = readDraft(currentDraftKey);
      if (draft && (draft.title.trim() || draft.content.trim())) {
        draftResolutionPendingRef.current = true;
        setPendingDraft(draft);
      }
    }
  }, [currentDraftKey, isEdit, readDraft]);

  // Load Existing Document if Edit Mode
  const loadDocument = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const doc = await api.getAdminDocument(Number(id));
      if (doc) {
        serverUpdatedAtRef.current = doc.updated_at;
        serverSnapshotRef.current = documentSnapshot(doc);
        setTitle(doc.title);
        setSlug(doc.slug);
        setContent(doc.content || '');
        setExcerpt(doc.excerpt || '');
        setCover(doc.cover || '');
        setStatus(doc.status || 'draft');
        setCategoryId(doc.category_id || 0);
        setIsPinned(doc.is_pinned || false);
        setTags(doc.tags || []);
        initialLoadedRef.current = true;

        // Check if there is an uncommitted local draft for this specific document
        const draft = readDraft(currentDraftKey);
        if (draft) {
          // If server was updated at or after draft's updatedAt, draft is superseded / stale
          const serverTime = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
          if (serverTime > 0 && draft.updatedAt <= serverTime) {
            removeDraft(currentDraftKey);
          } else {
            const hasDifference = localDraftDiffersFromDocument(draft, doc);
            if (hasDifference) {
              draftResolutionPendingRef.current = true;
              setPendingDraft(draft);
              setDraftHasServerConflict(Boolean(
                draft.serverUpdatedAt && draft.serverUpdatedAt !== doc.updated_at,
              ));
            } else {
              removeDraft(currentDraftKey);
            }
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || '文档加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentDraftKey, id, readDraft, removeDraft]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // 🌟 1000ms Debounce LocalStorage Auto-save & Ref Sync
  useEffect(() => {
    titleRef.current = title;
    slugRef.current = slug;
    contentRef.current = content;
    excerptRef.current = excerpt;
    coverRef.current = cover;
    statusRef.current = status;
    categoryIdRef.current = categoryId;
    isPinnedRef.current = isPinned;
    tagsRef.current = tags;
    loadingRef.current = loading;

    if (!initialLoadedRef.current || loading || pendingDraft) return;
    if (!isEdit && !title.trim() && !content.trim()) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const draftData: LocalDraftData = {
        version: 2,
        localDraftId,
        id: id ? Number(id) : 'new',
        title,
        slug,
        content,
        excerpt,
        cover,
        status,
        categoryId,
        isPinned,
        tags,
        updatedAt: Date.now(),
        serverUpdatedAt: serverUpdatedAtRef.current,
        editorEngine: EDITOR_ENGINE,
        contentFormat: detectContentFormat(content),
      };
      if (isEdit && serverSnapshotRef.current && localDraftMatchesSnapshot(draftData, serverSnapshotRef.current)) {
        removeDraft(currentDraftKey);
        setLastDraftSavedAt(null);
        setDraftStorageError(null);
        return;
      }
      const ok = writeDraft(currentDraftKey, draftData);
      if (ok) {
        setLastDraftSavedAt(draftData.updatedAt);
        setDraftStorageError(null);
      } else {
        setDraftStorageError('本地草稿暂存失败，请检查浏览器存储空间或隐私设置。');
      }
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [categoryId, content, cover, currentDraftKey, excerpt, id, isEdit, isPinned, loading, localDraftId, pendingDraft, removeDraft, slug, status, tags, title, writeDraft]);

  // 🌟 Synchronous Flush on BeforeUnload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!initialLoadedRef.current || loadingRef.current || pendingDraft) return;
      if (!isEdit && !titleRef.current.trim() && !contentRef.current.trim()) return;

      const draftData: LocalDraftData = {
        version: 2,
        localDraftId,
        id: id ? Number(id) : 'new',
        title: titleRef.current,
        slug: slugRef.current,
        content: contentRef.current,
        excerpt: excerptRef.current,
        cover: coverRef.current,
        status: statusRef.current,
        categoryId: categoryIdRef.current,
        isPinned: isPinnedRef.current,
        tags: tagsRef.current,
        updatedAt: Date.now(),
        serverUpdatedAt: serverUpdatedAtRef.current,
        editorEngine: EDITOR_ENGINE,
        contentFormat: detectContentFormat(contentRef.current),
      };
      if (isEdit && serverSnapshotRef.current && localDraftMatchesSnapshot(draftData, serverSnapshotRef.current)) return;
      writeDraft(currentDraftKey, draftData);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentDraftKey, id, isEdit, localDraftId, pendingDraft, writeDraft]);

  useEffect(() => () => {
    if (suppressUnmountDraftRef.current || !initialLoadedRef.current || loadingRef.current || draftResolutionPendingRef.current) return;
    if (!isEdit && !titleRef.current.trim() && !contentRef.current.trim()) return;
    const draftData: LocalDraftData = {
      version: 2,
      localDraftId,
      id: id ? Number(id) : 'new',
      title: titleRef.current,
      slug: slugRef.current,
      content: contentRef.current,
      excerpt: excerptRef.current,
      cover: coverRef.current,
      status: statusRef.current,
      categoryId: categoryIdRef.current,
      isPinned: isPinnedRef.current,
      tags: tagsRef.current,
      updatedAt: Date.now(),
      serverUpdatedAt: serverUpdatedAtRef.current,
      editorEngine: EDITOR_ENGINE,
      contentFormat: detectContentFormat(contentRef.current),
    };
    if (isEdit && serverSnapshotRef.current && localDraftMatchesSnapshot(draftData, serverSnapshotRef.current)) return;
    writeDraft(currentDraftKey, draftData);
  }, [currentDraftKey, id, isEdit, localDraftId, writeDraft]);

  const flushLocalDraft = useCallback((showConfirmation = false): boolean => {
    const contentToStore = EDITOR_ENGINE === 'tiptap'
      ? tiptapEditorRef.current?.getContentForSave() ?? content
      : content;
    if (!isEdit && !title.trim() && !contentToStore.trim()) return true;

    const draftData: LocalDraftData = {
      version: 2,
      localDraftId,
      id: id ? Number(id) : 'new',
      title,
      slug,
      content: contentToStore,
      excerpt,
      cover,
      status,
      categoryId,
      isPinned,
      tags,
      updatedAt: Date.now(),
      serverUpdatedAt: serverUpdatedAtRef.current,
      editorEngine: EDITOR_ENGINE,
      contentFormat: detectContentFormat(contentToStore),
    };
    if (isEdit && serverSnapshotRef.current && localDraftMatchesSnapshot(draftData, serverSnapshotRef.current)) {
      removeDraft(currentDraftKey);
      setLastDraftSavedAt(null);
      setDraftStorageError(null);
      if (showConfirmation) setSuccessMsg('当前没有未提交修改，线上版本保持不变。');
      return true;
    }
    const saved = writeDraft(currentDraftKey, draftData);
    if (saved) {
      setLastDraftSavedAt(draftData.updatedAt);
      setDraftStorageError(null);
      if (showConfirmation) setSuccessMsg('修改已暂存到当前浏览器，线上版本保持不变。');
    } else {
      setDraftStorageError('本地草稿暂存失败，请检查浏览器存储空间或隐私设置。');
    }
    return saved;
  }, [categoryId, content, cover, currentDraftKey, excerpt, id, isEdit, isPinned, localDraftId, removeDraft, slug, status, tags, title, writeDraft]);

  // 🌟 Apply & Discard Draft Handlers
  const handleApplyDraft = () => {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setSlug(pendingDraft.slug);
    setContent(pendingDraft.content);
    setExcerpt(pendingDraft.excerpt);
    setCover(pendingDraft.cover);
    setStatus(pendingDraft.status);
    setCategoryId(pendingDraft.categoryId);
    setIsPinned(pendingDraft.isPinned);
    setTags(pendingDraft.tags);
    setLastDraftSavedAt(pendingDraft.updatedAt);
    draftResolutionPendingRef.current = false;
    setPendingDraft(null);
    setDraftHasServerConflict(false);
    setSuccessMsg('✨ 已成功恢复本地未提交草稿！');
  };

  const handleDiscardDraft = () => {
    removeDraft(currentDraftKey);
    draftResolutionPendingRef.current = false;
    setPendingDraft(null);
    setDraftHasServerConflict(false);
    setSuccessMsg('已放弃本地草稿，当前处于最新状态。');
  };

  // Upload Media and return it to the visual editor for cursor-position insertion
  const handleUploadFile = async (file: File): Promise<Media> => {
    setUploading(true);
    setErrorMsg(null);
    try {
      const docId = id ? Number(id) : undefined;
      const docTitle = title.trim() || undefined;
      const media = await api.uploadMedia(file, {
        document_id: docId,
        doc_title: docTitle,
      });
      setSuccessMsg(`上传成功: ${media.original_name}`);
      return media;
    } catch (err: any) {
      setErrorMsg(err.message || '文件上传失败');
      throw err;
    } finally {
      setUploading(false);
    }
  };

  // Save Document with Race Condition Protection
  const handleSave = async (targetStatus?: string) => {
    if (!title.trim()) {
      setErrorMsg('请填写文档标题');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const docStatus = targetStatus || status;

    let contentToSave = EDITOR_ENGINE === 'tiptap'
      ? tiptapEditorRef.current?.getContentForSave() ?? content
      : content;

    if (isEdit && status === 'published' && docStatus === 'draft') {
      flushLocalDraft(true);
      return;
    }

    setSaving(true);

    // 🌟 自动转存文章中的所有外链/临时图片至本地媒体库专属文件夹
    try {
      const locRes = await api.localizeDocumentImages(contentToSave, id ? Number(id) : 0, title.trim());
      if (locRes && locRes.content) {
        contentToSave = locRes.content;
        setContent(locRes.content);
      }
    } catch (locErr) {
      console.warn('转存文档外链图片失败，继续保存:', locErr);
    }

    const payload: DocumentSaveReq = buildDocumentPayload({
      title,
      slug,
      content: contentToSave,
      excerpt,
      cover,
      status: docStatus,
      categoryId,
      isPinned,
      tags,
    });

    // 🌟 Capture snapshot for race condition protection
    const savingSnapshot: LocalDraftData = {
      version: 2,
      localDraftId,
      id: id ? Number(id) : 'new',
      title: payload.title,
      slug: payload.slug || slug,
      content: payload.content || '',
      excerpt: payload.excerpt || '',
      cover: payload.cover || '',
      status: docStatus,
      categoryId: payload.category_id || 0,
      isPinned: Boolean(payload.is_pinned),
      tags: payload.tags || [],
      updatedAt: Date.now(),
      serverUpdatedAt: serverUpdatedAtRef.current,
    };

    try {
      if (isEdit && id) {
        const updated = await api.updateDocument(Number(id), payload);
        serverUpdatedAtRef.current = updated.updated_at;
        serverSnapshotRef.current = documentSnapshot(updated);
        setContent(contentToSave);
        tiptapEditorRef.current?.markSaved(contentToSave);
        setStatus(docStatus);
        setSuccessMsg('文档更新成功');

        // Successfully saved to server: clear local draft and suppress unmount draft write
        suppressUnmountDraftRef.current = true;
        removeDraft(currentDraftKey);
        draftResolutionPendingRef.current = false;
        setPendingDraft(null);
        setLastDraftSavedAt(null);
      } else {
        const created = await api.createDocument(payload);
        suppressUnmountDraftRef.current = true;
        setSuccessMsg('文档创建成功');

        const latestDraft = readDraft(currentDraftKey);
        if (!latestDraft || localDraftMatchesSnapshot(latestDraft, savingSnapshot)) {
          removeDraft(currentDraftKey);
          draftResolutionPendingRef.current = false;
          setPendingDraft(null);
          setLastDraftSavedAt(null);
        } else {
          const migrated = writeDraft(getDraftKey(created.id), {
            ...latestDraft,
            id: created.id,
            localDraftId: undefined,
            serverUpdatedAt: created.updated_at,
          });
          if (migrated) removeDraft(currentDraftKey);
        }

        setTimeout(() => {
          navigate(`/admin/documents/${created.id}`, { replace: true });
        }, 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '保存文档失败');
      // On API failure, LocalStorage draft remains intact!
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-xs">
        <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        加载文档编辑数据...
      </div>
    );
  }

  return (
    <div className="admin-editor-workspace flex h-full min-h-0 w-full flex-col gap-4">
      {/* 🌟 Header Bar with Navigation Toggles */}
      <div className="admin-editor-workspace-header flex shrink-0 flex-col justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700 lg:flex-row lg:items-center">
        <div className="flex items-center space-x-2 md:space-x-3">
          <button
            onClick={() => {
              flushLocalDraft();
              navigate('/admin/documents');
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="返回文档列表"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Left Knowledge Tree Toggle */}
          <button
            type="button"
            onClick={handleTreePanelToggle}
            className={`p-1.5 px-2.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
              showDocTree || activeOverlayPanel === 'tree'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
            title={showDocTree || activeOverlayPanel === 'tree' ? '收起知识库目录' : '展开知识库目录'}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">目录导航</span>
          </button>

          {/* Right TOC Outline Toggle */}
          <button
            type="button"
            onClick={handleOutlinePanelToggle}
            className={`p-1.5 px-2.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition ${
              showToc || activeOverlayPanel === 'outline'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
            title={showToc || activeOverlayPanel === 'outline' ? '收起文章大纲' : '展开文章大纲'}
          >
            <ListTree className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">文章大纲</span>
            {tocItems.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                {tocItems.length}
              </span>
            )}
          </button>

          <h1 className="sr-only">{isEdit ? '编辑 Markdown 文档' : '新建 Markdown 文档'}</h1>
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="document-title" className="sr-only">文档标题</label>
            <input
              id="document-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="输入文档标题"
              className="h-9 w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold tracking-tight text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-52 lg:w-48 xl:w-56"
            />
            <span className={`hidden shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold md:inline-flex ${
              status === 'published'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            }`}>
              {status === 'published' ? '已发布' : '草稿'}
            </span>
          </div>

          <div className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-slate-500 dark:text-slate-400 xl:flex" aria-label="文档属性摘要">
            <span className="truncate">{categories.find((category) => category.id === categoryId)?.name || '未设置分类'}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{tags.length > 0 ? tags.slice(0, 2).map((tag) => `#${tag}`).join(' ') : '未添加标签'}</span>
            {tags.length > 2 && <span className="shrink-0">+{tags.length - 2}</span>}
            <span aria-hidden="true">·</span>
            <span className="truncate font-mono">{slug ? `/${slug}` : '未设置 Slug'}</span>
          </div>
        </div>

        {/* Action Buttons & View Switcher */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Draft Auto-saved Indicator */}
          {lastDraftSavedAt && (
            <div className="mr-1 hidden items-center space-x-1 text-xs font-medium text-slate-400 dark:text-slate-500 2xl:flex">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>已暂存，可安全离开 · {new Date(lastDraftSavedAt).toLocaleTimeString()}</span>
            </div>
          )}

          <button
            ref={propertiesTriggerRef}
            type="button"
            onClick={handlePropertiesToggle}
            aria-expanded={showProperties}
            aria-controls="editor-document-properties"
            className={`inline-flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              showProperties
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>属性</span>
          </button>

          {slug && (
            <a
              href={`/docs/${encodeURIComponent(slug)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              title="在新标签页中前台真实阅读此文档"
            >
              <span>在前台阅读此文</span>
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
            </a>
          )}
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            title={isEdit && status === 'published' ? '仅暂存到当前浏览器本地（不更新线上版本）' : '保存为草稿'}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isEdit && status === 'published' ? '暂存本地' : '保存草稿'}</span>
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-md transition disabled:opacity-50"
            title={isEdit && status === 'published' ? '保存修改并同步到线上' : '保存并发布'}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{saving ? '保存中...' : (isEdit && status === 'published' ? '保存修改' : '保存并发布')}</span>
          </button>
        </div>
      </div>

      {/* 🌟 本地未提交草稿/修改恢复横幅 (Local Draft/Changes Recovery Banner) */}
      {pendingDraft && (
        <div className="flex flex-col justify-between gap-3 rounded-ds-lg border border-amber-200 bg-amber-50 p-3.5 text-sm dark:border-amber-800/80 dark:bg-amber-950/40 sm:flex-row sm:items-center">
          <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200">
            <Clock className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>
                {draftHasServerConflict
                  ? (status === 'published' ? '发现本地未提交修改，但服务器已有更新' : '发现本地草稿，但服务器已有更新')
                  : (status === 'published' ? '发现本地未提交的修改' : '发现本地未提交草稿')}
              </strong>
              （自动暂存于{' '}
              {new Date(pendingDraft.updatedAt).toLocaleTimeString()}）
              {pendingDraft.serverUpdatedAt && (
                <span className="text-amber-700 dark:text-amber-300 ml-1.5 opacity-80">
                  [服务器最后更新: {new Date(pendingDraft.serverUpdatedAt).toLocaleTimeString()}]
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleApplyDraft}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold rounded-lg shadow-sm transition"
            >
              {status === 'published' ? '恢复未保存修改' : '恢复本地草稿'}
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg border border-amber-200 dark:border-slate-700 transition"
            >
              {draftHasServerConflict ? '保留服务器版本' : (status === 'published' ? '放弃修改' : '放弃草稿')}
            </button>
          </div>
        </div>
      )}

      {draftStorageError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{draftStorageError}</span>
        </div>
      )}

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 🌟 3-Column Navigation Workspace Layout */}
      <div
        className="admin-editor-workspace-body"
        data-tree-open={showDocTree ? 'true' : 'false'}
        data-outline-open={showToc ? 'true' : 'false'}
      >
        {activeOverlayPanel && (
          <button
            type="button"
            className="admin-editor-panel-backdrop"
            onClick={() => setActiveOverlayPanel(null)}
            aria-label="关闭辅助面板"
          />
        )}
        {showProperties && (
          <button
            type="button"
            className="admin-editor-properties-backdrop"
            onClick={closeProperties}
            aria-label="关闭文档属性"
          />
        )}
        {/* 1. Left Knowledge Base Tree Sidebar */}
        <div className={`admin-editor-panel-slot admin-editor-tree-slot ${activeOverlayPanel === 'tree' ? 'is-overlay-open' : ''}`}>
          <AdminDocTreeSidebar
            currentDocId={id ? parseInt(id, 10) : 'new'}
            isOpen={showDocTree || activeOverlayPanel === 'tree'}
            onToggle={handleTreePanelClose}
            onBeforeSwitch={() => flushLocalDraft()}
          />
        </div>

        {/* 2. Center Main Editor Workspace */}
        <div className="admin-editor-main-scroll flex min-h-0 min-w-0 flex-col space-y-4">
          {showProperties && (
            <section
              id="editor-document-properties"
              className="admin-editor-properties-panel rounded-2xl border border-slate-200 bg-slate-50/95 p-4 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
              aria-label="文档属性"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">文档属性</h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">编辑发布地址、分类、标签与公开描述</p>
                </div>
                <button
                  type="button"
                  onClick={closeProperties}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="关闭文档属性"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="document-slug" className="font-semibold text-slate-700 dark:text-slate-300">URL Slug</label>
                  <input
                    ref={propertiesFirstInputRef}
                    id="document-slug"
                    type="text"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="留空自动根据标题生成拼音/英文"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="document-category" className="font-semibold text-slate-700 dark:text-slate-300">所属分类</label>
                  <select
                    id="document-category"
                    value={categoryId}
                    onChange={(event) => setCategoryId(Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value={0}>未分类 (顶级目录)</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.parent_id ? '  └ ' : ''}
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">文档标签</label>
                  <TagCombobox
                    availableTags={availableTags}
                    selectedTags={tags}
                    loading={tagsLoading}
                    onChange={setTags}
                    onCreate={(name) => api.createTag(name)}
                    onCreated={(created) => setAvailableTags((current) => (
                      current.some((tag) => tag.id === created.id) ? current : [created, ...current]
                    ))}
                  />
                </div>

                <div className="space-y-1 md:col-span-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="document-description" className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                      <MessageSquareText className="h-4 w-4 text-blue-500" />
                      内容描述
                      <span className="hidden font-normal text-slate-400 sm:inline">用于首页、文章列表和正文标题下方</span>
                    </label>
                    <span className="shrink-0 text-[11px] font-medium text-slate-400">{Array.from(excerpt).length}/120</span>
                  </div>
                  <textarea
                    id="document-description"
                    value={excerpt}
                    maxLength={120}
                    rows={2}
                    onChange={(event) => setExcerpt(event.target.value)}
                    placeholder="用一两句话概括这篇内容；留空则前台不显示描述。"
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </section>
          )}

          {/* 沉浸式可视化文档画布 */}
          <div className="flex min-h-[650px] flex-1 flex-col">
            {EDITOR_ENGINE === 'tiptap' ? (
              <Suspense fallback={<div className="min-h-[680px] rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">加载隐藏 TipTap PoC...</div>}>
                <TiptapEditor
                  ref={tiptapEditorRef}
                  content={content}
                  onChange={setContent}
                  onUploadFile={handleUploadFile}
                  uploading={uploading}
                />
              </Suspense>
            ) : (
              <DocumentVisualEditor
                markdownContent={content}
                onChange={(newMd) => setContent(newMd)}
                onUploadFile={handleUploadFile}
                uploading={uploading}
                documentId={id ? Number(id) : undefined}
                docTitle={title}
              />
            )}
          </div>
        </div>

        {/* 3. 🌟 Right Live TOC Outline Sidebar */}
        {(showToc || activeOverlayPanel === 'outline') && (
          <div className={`admin-editor-panel-slot admin-editor-outline-slot ${activeOverlayPanel === 'outline' ? 'is-overlay-open' : ''}`}>
          <aside className="static flex h-72 w-full flex-shrink-0 flex-col overflow-hidden rounded-ds-lg border border-border-subtle bg-surface xl:sticky xl:top-20 xl:h-[calc(100vh-8.5rem)] xl:w-72 2xl:w-80">
            {/* Outline Header with Quick Controls */}
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100 font-bold text-xs">
                <ListTree className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>本文大纲</span>
                <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {tocItems.length}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setOutlineWrapText(!outlineWrapText)}
                  className={`p-1 rounded-lg transition ${
                    outlineWrapText
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title={outlineWrapText ? '当前为换行看全模式 (点击切换为单行紧凑)' : '当前为单行紧凑模式 (点击切换为换行看全)'}
                >
                  <WrapText className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowOutlineSearch(!showOutlineSearch)}
                  className={`p-1 rounded-lg transition ${
                    showOutlineSearch || outlineSearch
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title="搜索过滤大纲小节"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleOutlinePanelClose}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="收起大纲"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Optional Search Filter Input */}
            {showOutlineSearch && (
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 relative">
                <Search className="w-3 h-3 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={outlineSearch}
                  onChange={(e) => setOutlineSearch(e.target.value)}
                  placeholder="筛选大纲小节..."
                  autoFocus
                  className="w-full pl-7 pr-7 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 dark:text-slate-200"
                />
                {outlineSearch && (
                  <button
                    type="button"
                    onClick={() => setOutlineSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Outline List Items */}
            <div className="toc-tree-guide flex-1 overflow-y-auto p-2 space-y-0.5 text-xs relative pl-1.5">
              {tocItems.length > 0 ? (
                (() => {
                  const filtered = outlineSearch.trim()
                    ? tocItems.filter((item) => item.text.toLowerCase().includes(outlineSearch.trim().toLowerCase()))
                    : tocItems;

                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center text-xs text-slate-400">
                        未找到匹配的小节
                      </div>
                    );
                  }

                  return filtered.map((item, idx) => {
                    const depth = Math.max(0, item.level - 1);
                    return (
                      <button
                        key={`toc-nav-${idx}-${item.id}`}
                        type="button"
                        onClick={() => handleTocClick(item)}
                        style={{ paddingLeft: `${depth * 12 + 6}px` }}
                        className="group relative w-full text-left py-1.5 pr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-start space-x-2 my-0.5"
                        title={item.text}
                      >
                        {/* Colorful Level Micro-Badge */}
                        <span
                          className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight ${
                            item.level === 1
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                              : item.level === 2
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : item.level === 3
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                          }`}
                        >
                          H{item.level}
                        </span>

                        {/* Heading Text Content */}
                        <span
                          className={`min-w-0 flex-1 leading-snug tracking-tight ${
                            outlineWrapText ? 'break-words' : 'truncate'
                          } ${
                            item.level === 1
                              ? 'font-bold text-slate-800 dark:text-slate-100'
                              : item.level === 2
                              ? 'font-medium text-slate-700 dark:text-slate-200'
                              : 'text-slate-600 dark:text-slate-400'
                          } group-hover:text-blue-600 dark:group-hover:text-blue-400`}
                        >
                          {item.text}
                        </span>
                      </button>
                    );
                  });
                })()
              ) : (
                <div className="p-6 text-center text-xs text-slate-400 leading-relaxed">
                  正文输入 H1~H4 标题自动提取大纲
                </div>
              )}
            </div>
          </aside>
          </div>
        )}
      </div>
    </div>
  );
};
