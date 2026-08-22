import { BrowserRouter } from 'react-router-dom';

import { AppProviders } from './providers/AppProviders.jsx';
import { AppRouter } from './router.jsx';

export function App({ authGateway }) {
  return (
    <AppProviders authGateway={authGateway}>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
