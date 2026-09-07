export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-brand text-white hover:bg-brand-hover',
  secondary: 'border-border-default bg-surface text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
  ghost: 'border-transparent bg-transparent text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
  danger: 'border-transparent bg-danger text-white hover:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
};

export const buttonClassName = ({
  variant = 'secondary',
  size = 'md',
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) => [
  'inline-flex items-center justify-center gap-2 rounded-ds-md border font-semibold transition-colors duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  'disabled:pointer-events-none disabled:opacity-45',
  variantClasses[variant],
  sizeClasses[size],
  className,
].filter(Boolean).join(' ');
