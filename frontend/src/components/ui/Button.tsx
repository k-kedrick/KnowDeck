import type { ButtonHTMLAttributes } from 'react';
import { buttonClassName } from './buttonStyles';
import type { ButtonSize, ButtonVariant } from './buttonStyles';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = ({ variant, size, className, type = 'button', ...props }: ButtonProps) => (
  <button
    type={type}
    className={buttonClassName({ variant, size, className })}
    {...props}
  />
);
