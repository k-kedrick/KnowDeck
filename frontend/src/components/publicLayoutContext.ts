import type { CategoryTreeNode, SiteInfo } from '../api';

export interface PublicOutletContext {
  siteInfo: SiteInfo | null;
  tree: CategoryTreeNode[];
  openSearch: () => void;
  tocItems?: { id: string; text: string; level: number }[];
  setTocItems?: (items: { id: string; text: string; level: number }[]) => void;
  activeHeadingId?: string;
  setActiveHeadingId?: (id: string) => void;
  onSelectHeading?: (id: string) => void;
  currentDocTitle?: string;
  setCurrentDocTitle?: (title: string) => void;
}

export const findFirstDocSlug = (nodes: CategoryTreeNode[]): string | null => {
  for (const node of nodes) {
    if (node.documents?.length) return node.documents[0].slug;
    const childSlug = node.children?.length ? findFirstDocSlug(node.children) : null;
    if (childSlug) return childSlug;
  }
  return null;
};

