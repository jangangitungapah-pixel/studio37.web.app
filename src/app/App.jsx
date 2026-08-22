import { BrowserRouter } from 'react-router-dom';

import { AppProviders } from './providers/AppProviders.jsx';
import { AppRouter } from './router.jsx';

export function App({
  authGateway,
  permissionSetRepository,
  studioRoomRepository,
  studioSettingsRepository,
  userProfileRepository,
}) {
  return (
    <AppProviders
      authGateway={authGateway}
      permissionSetRepository={permissionSetRepository}
      userProfileRepository={userProfileRepository}
    >
      <BrowserRouter>
        <AppRouter
          studioRoomRepository={studioRoomRepository}
          studioSettingsRepository={studioSettingsRepository}
        />
      </BrowserRouter>
    </AppProviders>
  );
}
