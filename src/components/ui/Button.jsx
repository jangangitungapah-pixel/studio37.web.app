import './button.css';

const supportedVariants = new Set(['primary', 'secondary', 'ghost', 'danger']);
const supportedSizes = new Set(['sm', 'md', 'lg']);

export function Button({
  children,
  className = '',
  disabled = false,
  loading = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}) {
  const resolvedVariant = supportedVariants.has(variant) ? variant : 'primary';
  const resolvedSize = supportedSizes.has(size) ? size : 'md';
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'ui-button',
        `ui-button--${resolvedVariant}`,
        `ui-button--${resolvedSize}`,
        loading ? 'ui-button--loading' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : null}
      <span className="ui-button__label">{children}</span>
    </button>
  );
}
