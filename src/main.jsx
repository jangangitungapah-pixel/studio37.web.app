import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App.jsx';
import { ToastProvider } from './components/feedback/ToastProvider.jsx';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
