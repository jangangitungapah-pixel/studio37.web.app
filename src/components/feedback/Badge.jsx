import './badge.css';

const supportedTones = new Set(['neutral', 'brand', 'success', 'warning', 'danger', 'info']);

export function Badge({ children, className = '', tone = 'neutral' }) {
  const resolvedTone = supportedTones.has(tone) ? tone : 'neutral';

  return (
    <span
      className={['ui-badge', `ui-badge--${resolvedTone}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  );
}
