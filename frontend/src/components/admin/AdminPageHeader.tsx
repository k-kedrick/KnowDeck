import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AdminPageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}

export const AdminPageHeader = ({ icon: Icon, title, description, actions }: AdminPageHeaderProps) => (
  <header className="flex min-h-14 flex-col gap-3 border-b border-border-subtle pb-4 xl:flex-row xl:items-center xl:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      {Icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-text-tertiary">{description}</p>
      </div>
    </div>
    {actions && <div className="flex shrink-0 self-start items-center gap-2.5 xl:self-auto">{actions}</div>}
  </header>
);

