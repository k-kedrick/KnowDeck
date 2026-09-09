import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Full-viewport dialogs must escape page-layout stacking and overflow contexts. */
export const ModalPortal = ({ children }: { children: ReactNode }) => (
  typeof document === 'undefined' ? <>{children}</> : createPortal(children, document.body)
);
