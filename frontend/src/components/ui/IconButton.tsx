import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
}

export const IconButton = ({ label, size = 'md', className = '', type = 'button', ...props }: IconButtonProps) => (
  <button
    type={type}
    aria-label={label}
    title={props.title || label}
    className={[
      'inline-flex shrink-0 items-center justify-center rounded-ds-md text-text-secondary transition-colors duration-150',
      'hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
      className,
    ].filter(Boolean).join(' ')}
    {...props}
  />
);
