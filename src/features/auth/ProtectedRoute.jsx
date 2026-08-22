import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './useAuth.js';
import './auth.css';

export function ProtectedRoute() {
  const location = useLocation();
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <main className="auth-status" aria-live="polite">
        <span className="auth-status__spinner" aria-hidden="true" />
        <p>Memeriksa sesi Studio37…</p>
      </main>
    );
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
