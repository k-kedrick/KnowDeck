import type { ReactNode } from 'react';

export const AdminPageShell = ({ children }: { children: ReactNode }) => (
  <div className="admin-page-shell">{children}</div>
);
