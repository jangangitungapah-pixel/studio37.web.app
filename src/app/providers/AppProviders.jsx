import { AuthProvider } from '../../features/auth/AuthProvider.jsx';

export function AppProviders({ authGateway, children }) {
  return <AuthProvider gateway={authGateway}>{children}</AuthProvider>;
}
