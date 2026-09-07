import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminPageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}

export const AdminPageHeader = ({ icon: Icon, title, description, actions }: AdminPageHeaderProps) => (
  <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />}
        <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{title}</h1>
      </div>
      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-text-tertiary">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
);
