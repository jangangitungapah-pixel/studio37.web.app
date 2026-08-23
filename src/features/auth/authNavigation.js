const fallbackPath = '/dashboard';

export function getPostLoginPath(from) {
  const pathname = from?.pathname;

  if (
    typeof pathname !== 'string' ||
    !pathname.startsWith('/') ||
    pathname.startsWith('//') ||
    pathname === '/login'
  ) {
    return fallbackPath;
  }

  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';

  return `${pathname}${search}${hash}`;
}
