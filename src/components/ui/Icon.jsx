const iconPaths = Object.freeze({
  dashboard: [
    'M4 4h6v6H4z',
    'M14 4h6v4h-6z',
    'M14 12h6v8h-6z',
    'M4 14h6v6H4z',
  ],
  calendar: ['M6 3v3M18 3v3M4 8h16', 'M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z'],
  coins: [
    'M8 7c0 1.66 2.69 3 6 3s6-1.34 6-3-2.69-3-6-3-6 1.34-6 3Z',
    'M8 7v4c0 1.66 2.69 3 6 3s6-1.34 6-3V7',
    'M8 11v4c0 1.66 2.69 3 6 3s6-1.34 6-3v-4',
    'M4 9c-2.4.42-4 1.38-4 2.5C0 13 2.24 14.26 5.2 14.47',
    'M5.2 18.47C2.24 18.26 0 17 0 15.5v-4',
  ],
  book: ['M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22z', 'M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z'],
  settings: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2 3.46-.08-.02a1.7 1.7 0 0 0-1.8.55l-.08.05a1.7 1.7 0 0 0-.8 1.56V22H9v-.09a1.7 1.7 0 0 0-.8-1.56l-.08-.05a1.7 1.7 0 0 0-1.8-.55l-.08.02-2-3.46.06-.06A1.7 1.7 0 0 0 4.6 15l-.02-.1A1.7 1.7 0 0 0 3.6 13.5L3.5 13v-2l.1-.5a1.7 1.7 0 0 0 .98-1.4l.02-.1a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2-3.46.08.02a1.7 1.7 0 0 0 1.8-.55l.08-.05A1.7 1.7 0 0 0 9 1.46V1h6v.46a1.7 1.7 0 0 0 .8 1.56l.08.05a1.7 1.7 0 0 0 1.8.55l.08-.02 2 3.46-.06.06a1.7 1.7 0 0 0-.34 1.88l.02.1a1.7 1.7 0 0 0 .98 1.4l.1.5v2l-.1.5a1.7 1.7 0 0 0-.98 1.4Z',
  ],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  close: ['m6.5 6.5 11 11', 'm17.5 6.5-11 11'],
  chevronDown: ['m7 9.5 5 5 5-5'],
  check: ['m5 12.5 4 4L19 6.5'],
  info: ['M12 10.5v6', 'M12 7.5h.01', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  warning: ['M12 9v4', 'M12 17h.01', 'M10.3 3.8 2.2 5.5a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3l-8.1-13.7a2 2 0 0 0-3.4 0Z'],
  success: ['m8 12 2.7 2.7L16.5 9', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  logout: ['M10 5H5v14h5', 'M14 8l4 4-4 4', 'M18 12H9'],
  search: ['M21 21l-4.4-4.4', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'],
});

export function Icon({ className = '', name, size = 18, strokeWidth = 1.8 }) {
  const paths = iconPaths[name] ?? iconPaths.info;

  return (
    <svg
      aria-hidden="true"
      className={['ui-icon', className].filter(Boolean).join(' ')}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths.map((path, index) => (
        <path
          key={`${name}-${index}`}
          d={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
