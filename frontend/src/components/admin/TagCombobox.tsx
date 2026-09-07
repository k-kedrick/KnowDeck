import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Plus, Tag as TagIcon, X } from 'lucide-react';
import type { Tag } from '../../api';

interface TagComboboxProps {
  availableTags: Tag[];
  selectedTags: string[];
  loading?: boolean;
  onChange: (tags: string[]) => void;
  onCreate: (name: string) => Promise<Tag>;
  onCreated: (tag: Tag) => void;
}

const normalized = (value: string) => value.trim().toLocaleLowerCase();

export const TagCombobox = ({
  availableTags,
  selectedTags,
  loading = false,
  onChange,
  onCreate,
  onCreated,
}: TagComboboxProps) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedNames = new Set(selectedTags.map(normalized));
  const trimmedQuery = query.trim();
  const needle = normalized(query);
  const filteredTags = availableTags.filter((tag) => (
    !selectedNames.has(normalized(tag.name))
    && (!needle || normalized(tag.name).includes(needle) || normalized(tag.slug).includes(needle))
  ));
  const exactMatch = availableTags.some((tag) => normalized(tag.name) === normalized(trimmedQuery));
  const canCreate = Boolean(trimmedQuery) && !exactMatch && !selectedNames.has(normalized(trimmedQuery));
  const optionCount = filteredTags.length + (canCreate ? 1 : 0);
  const activeIndex = optionCount ? Math.min(highlightedIndex, optionCount - 1) : 0;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const selectTag = (tag: Tag) => {
    if (!selectedNames.has(normalized(tag.name))) onChange([...selectedTags, tag.name]);
    setQuery('');
    setError(null);
    setOpen(true);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const createAndSelect = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await onCreate(trimmedQuery);
      onCreated(created);
      selectTag(created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建标签失败');
    } finally {
      setCreating(false);
    }
  };

  const activateOption = () => {
    if (activeIndex < filteredTags.length) {
      selectTag(filteredTags[activeIndex]);
    } else if (canCreate) {
      void createAndSelect();
    }
  };

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <div className="document-control flex min-h-9 flex-wrap items-center gap-1.5 px-2 py-1 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        {selectedTags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            #{tag}
            <button
              type="button"
              aria-label={`移除标签 ${tag}`}
              onClick={() => onChange(selectedTags.filter((item) => normalized(item) !== normalized(tag)))}
              className="rounded text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="document-tag-options"
          aria-autocomplete="list"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlightedIndex(0);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setHighlightedIndex((index) => optionCount ? (index + 1) % optionCount : 0);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setHighlightedIndex((index) => optionCount ? (index - 1 + optionCount) % optionCount : 0);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (open && optionCount) activateOption();
            } else if (event.key === 'Escape') {
              setOpen(false);
            } else if (event.key === 'Backspace' && !query && selectedTags.length) {
              onChange(selectedTags.slice(0, -1));
            }
          }}
          placeholder={selectedTags.length ? '继续添加…' : '搜索或创建标签…'}
          className="min-w-28 flex-1 border-0 bg-transparent px-1 py-1 text-xs text-slate-900 shadow-none outline-none dark:text-white"
        />
        {loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      </div>

      {open && (
        <div id="document-tag-options" role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {!loading && filteredTags.map((tag, index) => (
            <button
              key={tag.id}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectTag(tag)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs ${activeIndex === index ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              <span className="flex min-w-0 items-center gap-2"><TagIcon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">#{tag.name}</span><span className="truncate font-mono text-[10px] text-slate-400">/{tag.slug}</span></span>
              <span className="shrink-0 text-[10px] text-slate-400">{tag.doc_count ?? 0} 篇</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === filteredTags.length}
              disabled={creating}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void createAndSelect()}
              onMouseEnter={() => setHighlightedIndex(filteredTags.length)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium ${activeIndex === filteredTags.length ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'text-blue-600 hover:bg-blue-50 dark:text-blue-400'}`}
            >
              {creating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              创建并使用 #{trimmedQuery}
            </button>
          )}
          {!loading && !optionCount && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400"><Check className="h-3.5 w-3.5" />没有更多可选标签</div>
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
};
