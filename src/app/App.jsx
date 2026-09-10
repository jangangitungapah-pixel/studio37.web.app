import { BrowserRouter } from 'react-router-dom';

import { AppProviders } from './providers/AppProviders.jsx';
import { AppRouter } from './router.jsx';

export function App({
  authGateway,
  customerRepository,
  operatorAccountInvitationRepository,
  operatorRepository,
  permissionAdministrationRepository,
  permissionSetRepository,
  pricingRuleRepository,
  sessionTypeRepository,
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
          customerRepository={customerRepository}
          operatorAccountInvitationRepository={operatorAccountInvitationRepository}
          operatorRepository={operatorRepository}
          permissionAdministrationRepository={permissionAdministrationRepository}
          pricingRuleRepository={pricingRuleRepository}
          sessionTypeRepository={sessionTypeRepository}
          studioRoomRepository={studioRoomRepository}
          studioSettingsRepository={studioSettingsRepository}
        />
      </BrowserRouter>
    </AppProviders>
  );
}
