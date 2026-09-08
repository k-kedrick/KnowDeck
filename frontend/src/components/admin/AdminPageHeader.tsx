import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminPageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}

export const AdminPageHeader = ({ icon: Icon, title, description, actions }: AdminPageHeaderProps) => (
  <header className="flex flex-col gap-4 border-b border-border-subtle/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3.5 min-w-0">
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/15 to-indigo-500/10 border border-brand/25 text-brand shadow-sm shadow-brand/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{title}</h1>
        <p className="mt-0.5 max-w-3xl text-xs sm:text-sm text-text-tertiary leading-relaxed">{description}</p>
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
  </header>
);

