import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './layouts/AppShell.jsx';
import { CapabilityRoute } from '../features/auth/CapabilityRoute.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { ProtectedRoute } from '../features/auth/ProtectedRoute.jsx';
import { ROUTE_POLICIES } from '../features/auth/routePolicies.js';
import { BookingDetailPage } from '../features/booking/BookingDetailPage.jsx';
import { BookkeepingPage } from '../features/bookkeeping/BookkeepingPage.jsx';
import { CalendarPage } from '../features/calendar/CalendarPage.jsx';
import { FeesCommissionsPage } from '../features/commissions/FeesCommissionsPage.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { DesignSystemPreviewPage } from '../features/dev/DesignSystemPreviewPage.jsx';
import { FirebaseStatusPage } from '../features/dev/FirebaseStatusPage.jsx';
import { SettingsPage } from '../features/settings/SettingsPage.jsx';
import { StudioSettingsPage } from '../features/settings/StudioSettingsPage.jsx';

export function AppRouter({ studioRoomRepository, studioSettingsRepository }) {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.DASHBOARD} />}>
            <Route path="dashboard" element={<DashboardPage />} />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.CALENDAR} />}>
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="bookings/:bookingId" element={<BookingDetailPage />} />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.FEES_COMMISSIONS} />}>
            <Route path="fees-commissions" element={<FeesCommissionsPage />} />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.BOOKKEEPING} />}>
            <Route path="bookkeeping" element={<BookkeepingPage />} />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.ACCOUNT} />}>
            <Route path="settings/account" element={<SettingsPage title="Account & Profile" />} />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.STUDIO} />}>
            <Route
              path="settings/studio"
              element={
                <StudioSettingsPage
                  repository={studioSettingsRepository}
                  roomRepository={studioRoomRepository}
                />
              }
            />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.PRICING} />}>
            <Route path="settings/pricing" element={<SettingsPage title="Price Settings" />} />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.OPERATORS} />}>
            <Route path="settings/operators" element={<SettingsPage title="Operator Settings" />} />
          </Route>

          <Route element={<CapabilityRoute policy={ROUTE_POLICIES.DANGER_ZONE} />}>
            <Route path="settings/danger-zone" element={<SettingsPage title="Danger Zone" />} />
          </Route>

          {import.meta.env.DEV ? (
            <Route element={<CapabilityRoute policy={ROUTE_POLICIES.DEVELOPMENT} />}>
              <Route path="dev/design-system" element={<DesignSystemPreviewPage />} />
              <Route path="dev/firebase" element={<FirebaseStatusPage />} />
            </Route>
          ) : null}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
