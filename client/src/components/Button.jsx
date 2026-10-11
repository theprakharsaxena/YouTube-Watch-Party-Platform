import { Loader2 } from 'lucide-react';

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children && <span>{children}</span>}
    </button>
  );
}

