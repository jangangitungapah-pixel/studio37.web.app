import { BrowserRouter } from 'react-router-dom';

import { AppProviders } from './providers/AppProviders.jsx';
import { AppRouter } from './router.jsx';

export function App({ authGateway, userProfileRepository }) {
  return (
    <AppProviders authGateway={authGateway} userProfileRepository={userProfileRepository}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
