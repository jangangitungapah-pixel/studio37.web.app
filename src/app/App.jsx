import { BrowserRouter } from 'react-router-dom';

import { AppProviders } from './providers/AppProviders.jsx';
import { AppRouter } from './router.jsx';

export function App({
  authGateway,
  operatorAccountInvitationRepository,
  operatorRepository,
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
          operatorAccountInvitationRepository={operatorAccountInvitationRepository}
          operatorRepository={operatorRepository}
          studioRoomRepository={studioRoomRepository}
          studioSettingsRepository={studioSettingsRepository}
        />
      </BrowserRouter>
    </AppProviders>
  );
}
