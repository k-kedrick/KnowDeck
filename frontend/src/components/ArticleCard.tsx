import { ArrowUpRight, Calendar, Eye, Folder, Lock, Pin, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DocumentListItem } from '../api';
import { formatDateTime } from '../utils/format';

export const ArticleCard = ({ document, compact = false }: { document: DocumentListItem; compact?: boolean }) => (
  <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 dark:border-slate-800/80 dark:bg-slate-900/90 dark:hover:border-blue-500/40">
    {/* Subtle top glow line on hover */}
    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

    <Link
      to={`/docs/${encodeURIComponent(document.slug)}`}
      aria-label={`阅读文章：${document.title}`}
      className="absolute inset-0 z-10 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    />

    <div className="min-w-0">
      {/* Top Meta & Action */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {document.is_pinned && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200/90 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300 shadow-xs">
              <Pin className="h-3 w-3" />
              置顶
            </span>
          )}
          {document.access_level === 'authenticated' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200/90 bg-indigo-50/95 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300 shadow-xs" title="此文章仅对登录用户开放">
              <Lock className="h-3 w-3" />
              登录可见
            </span>
          )}
          {document.category_name && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50/80 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400">
              <Folder className="h-3 w-3 opacity-75" />
              {document.category_name}
            </span>
          )}
          {document.author_name && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-text-tertiary">
              <User className="h-3 w-3" />
              {document.author_name}
            </span>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-text-tertiary transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
          阅读文章 <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>

      {/* Title */}
      <h2 className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-bold leading-snug tracking-tight text-text-primary transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1`}>
        {document.title}
      </h2>

      {/* Excerpt */}
      {document.access_level === 'authenticated' && !document.excerpt ? (
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-indigo-600/85 dark:text-indigo-400/85 italic line-clamp-2">
          🔒 此文章为成员专属内容，登录后即可查看完整内容与文档大纲。
        </p>
      ) : document.excerpt ? (
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-text-secondary line-clamp-2">
          {document.excerpt}
        </p>
      ) : null}
    </div>

    {/* Bottom Footer Bar */}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/90 pt-3 text-[11px] sm:text-xs text-text-tertiary dark:border-slate-800/80">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
          编辑于：{formatDateTime(document.updated_at || document.created_at)}
        </span>
        {document.views > 0 && (
          <>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {document.views} 次浏览
            </span>
          </>
        )}
      </div>

      {!!document.tags?.length && (
        <div className="flex flex-wrap gap-1.5">
          {document.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-md bg-slate-100/80 px-2 py-0.5 text-[11px] font-medium text-text-tertiary transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800/80 dark:group-hover:bg-blue-950/40 dark:group-hover:text-blue-400">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  </article>
);


