import { AuthProvider } from '../../features/auth/AuthProvider.jsx';

export function AppProviders({ authGateway, children, userProfileRepository }) {
  return (
    <AuthProvider gateway={authGateway} profileRepository={userProfileRepository}>
      {children}
    </AuthProvider>
  );
}
