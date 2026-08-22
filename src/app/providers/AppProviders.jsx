import { AuthProvider } from '../../features/auth/AuthProvider.jsx';

export function AppProviders({
  authGateway,
  children,
  permissionSetRepository,
  userProfileRepository,
}) {
  return (
    <AuthProvider
      gateway={authGateway}
      permissionRepository={permissionSetRepository}
      profileRepository={userProfileRepository}
    >
      {children}
    </AuthProvider>
  );
}
