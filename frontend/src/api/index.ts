export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  total: number;
  page: number;
  page_size: number;
  list: T[];
}

export interface SiteInfo {
  site_name: string;
  site_subtitle: string;
  site_logo: string;
  footer_text: string;
  allow_download: boolean;
  doc_count: number;
  category_count: number;
  tag_count: number;
}

export interface User {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  parent_id: number;
  sort_order: number;
  doc_count?: number;
  children?: Category[];
  created_at: string;
  updated_at: string;
}

export interface DocumentSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover: string;
  views: number;
  updated_at: string;
}

export interface CategoryTreeNode {
  id: number;
  name: string;
  slug: string;
  icon: string;
  children?: CategoryTreeNode[];
  documents?: DocumentSummary[];
}

export type DocumentStatus = 'draft' | 'published' | 'archived';

export interface DocumentListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover: string;
  status: DocumentStatus;
  category_id: number;
  author_id: number;
  sort_order: number;
  is_pinned: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  category_name?: string;
  category_slug?: string;
  author_name?: string;
  tags?: string[];
  reading_time?: number;
}

export interface DocumentDetail extends DocumentListItem {
  content: string;
}

export interface DocumentSaveReq {
  title: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  cover?: string;
  status?: string;
  category_id?: number;
  sort_order?: number;
  is_pinned?: boolean;
  tags?: string[];
}

export interface CategorySaveReq {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  parent_id?: number;
  sort_order?: number;
}

export interface DocumentNeighbor {
  prev?: DocumentSummary;
  next?: DocumentSummary;
}

export interface DocDetailData {
  document: DocumentDetail;
  neighbor?: DocumentNeighbor;
}

export interface SearchResult {
  id: number;
  title: string;
  slug: string;
  snippet: string;
  category_name: string;
  category_slug: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  doc_count: number;
  created_at?: string;
}

export interface MediaFolder {
  id: number;
  name: string;
  document_id: number;
  media_count: number;
  created_at: string;
  updated_at: string;
}

export interface MediaFolderListResponse {
  folders: MediaFolder[];
  total_media: number;
  unclassified_media: number;
}

export interface Media {
  id: number;
  folder_id?: number;
  original_name: string;
  filename: string;
  path: string;
  url: string;
  media_type: string;
  mime_type: string;
  size: number;
  duration: number;
  thumbnail: string;
  created_at: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE = '/api';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('kb_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(errorText);
      msg = errJson.message || msg;
    } catch {
      // ignore JSON parse error
    }
    throw new ApiError(msg, res.status);
  }

  const json: ApiResponse<T> = await res.json();
  if (json.code !== 0) {
    throw new Error(json.message || '请求失败');
  }

  return json.data;
}

export const api = {
  // Public APIs
  getSiteInfo: (signal?: AbortSignal) => fetchJson<SiteInfo>('/public/site/info', { signal }),
  getKnowledgeTree: (signal?: AbortSignal) =>
    fetchJson<CategoryTreeNode[] | null>('/public/categories/tree', { signal }).then((tree) => tree ?? []),
  getDocuments: (params: { category_id?: number; tag?: string; keyword?: string; page?: number; page_size?: number }, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    if (params.category_id) query.set('category_id', String(params.category_id));
    if (params.tag) query.set('tag', params.tag);
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return fetchJson<PageResponse<DocumentListItem>>(`/public/documents?${query.toString()}`, { signal });
  },
  getDocumentBySlug: (slug: string, signal?: AbortSignal) =>
    fetchJson<DocDetailData>(`/public/documents/${encodeURIComponent(slug)}`, { signal }),
  getTags: (signal?: AbortSignal) => fetchJson<Tag[]>('/public/tags', { signal }),
  search: (q: string, signal?: AbortSignal) => fetchJson<SearchResult[]>(`/public/search?q=${encodeURIComponent(q)}`, { signal }),

  // Admin Auth API
  login: (username: string, password: string) =>
    fetchJson<{ token: string; user: User }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => fetchJson<null>('/admin/auth/logout', { method: 'POST' }),
  getMe: () => fetchJson<User>('/admin/auth/me'),
  updateProfile: (data: { nickname?: string; email?: string; avatar?: string; old_password?: string; new_password?: string }) =>
    fetchJson<null>('/admin/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Admin Document API
  getAdminDocuments: (params: { status?: string; category_id?: number; tag?: string; keyword?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.category_id) query.set('category_id', String(params.category_id));
    if (params.tag) query.set('tag', params.tag);
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return fetchJson<PageResponse<DocumentListItem>>(`/admin/documents?${query.toString()}`);
  },
  getAdminDocument: (id: number) => fetchJson<DocumentDetail>(`/admin/documents/${id}`),
  createDocument: (data: DocumentSaveReq) =>
    fetchJson<DocumentDetail>('/admin/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDocument: (id: number, data: DocumentSaveReq) =>
    fetchJson<DocumentDetail>(`/admin/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateDocumentStatus: (id: number, status: DocumentStatus) =>
    fetchJson<DocumentListItem>(`/admin/documents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteDocument: (id: number) =>
    fetchJson<null>(`/admin/documents/${id}`, {
      method: 'DELETE',
    }),

  // Admin Category API
  getAdminCategories: () =>
    fetchJson<Category[] | null>('/admin/categories').then((categories) => categories ?? []),
  createCategory: (data: CategorySaveReq) =>
    fetchJson<Category>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: CategorySaveReq) =>
    fetchJson<Category>(`/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: number) =>
    fetchJson<null>(`/admin/categories/${id}`, {
      method: 'DELETE',
    }),

  // Admin Tag API
  getAdminTags: () => fetchJson<Tag[]>('/admin/tags'),
  createTag: (name: string, slug?: string) =>
    fetchJson<Tag>('/admin/tags', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    }),
  updateTag: (id: number, name: string, slug?: string) =>
    fetchJson<Tag>(`/admin/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, slug }),
    }),
  deleteTag: (id: number, force = false) =>
    fetchJson<null>(`/admin/tags/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
    }),

  // Admin Media API
  getAdminMedia: (params: { folder_id?: number; media_type?: string; keyword?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params.folder_id !== undefined && params.folder_id >= 0) query.set('folder_id', String(params.folder_id));
    if (params.media_type) query.set('media_type', params.media_type);
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return fetchJson<PageResponse<Media>>(`/admin/media?${query.toString()}`);
  },
  uploadMedia: async (
    file: File,
    options?: { folder_id?: number; document_id?: number; doc_title?: string }
  ): Promise<Media> => {
    const token = localStorage.getItem('kb_token');
    const formData = new FormData();
    formData.append('file', file);
    if (options?.folder_id !== undefined && options.folder_id > 0) {
      formData.append('folder_id', String(options.folder_id));
    }
    if (options?.document_id !== undefined && options.document_id > 0) {
      formData.append('document_id', String(options.document_id));
    }
    if (options?.doc_title) {
      formData.append('doc_title', options.doc_title);
    }
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/admin/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(text);
        msg = errJson.message || msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    const json: ApiResponse<Media> = await res.json();
    if (json.code !== 0) {
      throw new Error(json.message || '文件上传失败');
    }
    return json.data;
  },
  deleteMedia: (id: number) =>
    fetchJson<null>(`/admin/media/${id}`, {
      method: 'DELETE',
    }),

  // Admin Media Folders API
  getMediaFolders: () => fetchJson<MediaFolderListResponse>('/admin/media/folders'),
  createMediaFolder: (name: string, document_id?: number) =>
    fetchJson<MediaFolder>('/admin/media/folders', {
      method: 'POST',
      body: JSON.stringify({ name, document_id: document_id || 0 }),
    }),
  updateMediaFolder: (id: number, name: string) =>
    fetchJson<null>(`/admin/media/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),
  deleteMediaFolder: (id: number, keepMedia = true) =>
    fetchJson<null>(`/admin/media/folders/${id}?keep_media=${keepMedia}`, {
      method: 'DELETE',
    }),
  moveMedia: (id: number, folder_id: number) =>
    fetchJson<null>(`/admin/media/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify({ folder_id }),
    }),
  batchMoveMedia: (media_ids: number[], folder_id: number) =>
    fetchJson<null>('/admin/media/batch-move', {
      method: 'POST',
      body: JSON.stringify({ media_ids, folder_id }),
    }),
  saveExternalMedia: (url: string, options?: { folder_id?: number; document_id?: number; doc_title?: string }) =>
    fetchJson<Media>('/admin/media/save-external', {
      method: 'POST',
      body: JSON.stringify({ url, ...options }),
    }),
  localizeDocumentImages: (content: string, document_id?: number, doc_title?: string) =>
    fetchJson<{ content: string; localized_count: number }>('/admin/media/localize-images', {
      method: 'POST',
      body: JSON.stringify({ content, document_id: document_id || 0, doc_title: doc_title || '' }),
    }),

  // Admin Settings API
  getSettings: () => fetchJson<Record<string, string>>('/admin/settings'),
  saveSettings: (data: Record<string, string>) =>
    fetchJson<Record<string, string>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
