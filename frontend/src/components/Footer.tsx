import type { SiteInfo } from '../api';

export const Footer = ({ siteInfo }: { siteInfo: SiteInfo | null }) => (
  <footer className="page-gutter mt-auto border-t border-border-subtle bg-surface/50 py-6 text-xs text-text-tertiary transition-colors">
    <div className="layout-shell flex items-center justify-between">
      <p>{siteInfo?.footer_text || `© ${new Date().getFullYear()} ${siteInfo?.site_name || '知识库'}`}</p>
    </div>
  </footer>
);

