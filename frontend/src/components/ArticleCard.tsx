import { ArrowUpRight, Calendar, Eye, Folder, Pin, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DocumentListItem } from '../api';
import { formatDateTime } from '../utils/format';

export const ArticleCard = ({ document, compact = false }: { document: DocumentListItem; compact?: boolean }) => (
  <article className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-surface-elevated px-4 py-3 sm:px-5 sm:py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md hover:shadow-brand/5 dark:border-border-subtle`}>
    <Link
      to={`/docs/${encodeURIComponent(document.slug)}`}
      aria-label={`阅读文章：${document.title}`}
      className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    />

    <div className="min-w-0">
      {/* Top Meta & Action */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {document.is_pinned && (
            <span className="inline-flex items-center gap-0.5 rounded border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400">
              <Pin className="h-2.5 w-2.5" />
              置顶
            </span>
          )}
          {document.category_name && (
            <span className="inline-flex items-center gap-1 rounded border border-blue-100 bg-blue-50/80 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400">
              <Folder className="h-2.5 w-2.5 opacity-70" />
              {document.category_name}
            </span>
          )}
          {document.author_name && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-text-tertiary">
              <User className="h-2.5 w-2.5" />
              {document.author_name}
            </span>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-text-tertiary transition-colors group-hover:text-brand">
          阅读文章 <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>

      {/* Title */}
      <h2 className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-bold leading-snug tracking-tight text-text-primary transition-colors group-hover:text-brand line-clamp-1`}>
        {document.title}
      </h2>

      {/* Excerpt */}
      {document.excerpt && (
        <p className="mt-1 text-xs sm:text-sm leading-relaxed text-text-secondary line-clamp-1 sm:line-clamp-2">
          {document.excerpt}
        </p>
      )}
    </div>

    {/* Bottom Footer Bar */}
    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/70 pt-2 text-[11px] sm:text-xs text-text-tertiary">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Calendar className="h-3 w-3 text-text-tertiary" />
          编辑于：{formatDateTime(document.updated_at || document.created_at)}
        </span>
        {document.views > 0 && (
          <>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {document.views} 次浏览
            </span>
          </>
        )}
      </div>

      {!!document.tags?.length && (
        <div className="flex flex-wrap gap-1">
          {document.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="inline-flex items-center rounded bg-surface-subtle px-1.5 py-0.5 text-[11px] text-text-tertiary">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  </article>
);


