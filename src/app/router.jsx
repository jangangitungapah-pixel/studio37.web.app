import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './layouts/AppShell.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { BookingDetailPage } from '../features/booking/BookingDetailPage.jsx';
import { BookkeepingPage } from '../features/bookkeeping/BookkeepingPage.jsx';
import { CalendarPage } from '../features/calendar/CalendarPage.jsx';
import { FeesCommissionsPage } from '../features/commissions/FeesCommissionsPage.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { SettingsPage } from '../features/settings/SettingsPage.jsx';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="bookings/:bookingId" element={<BookingDetailPage />} />
        <Route path="fees-commissions" element={<FeesCommissionsPage />} />
        <Route path="bookkeeping" element={<BookkeepingPage />} />
        <Route path="settings/account" element={<SettingsPage title="Account & Profile" />} />
        <Route path="settings/studio" element={<SettingsPage title="Studio Settings" />} />
        <Route path="settings/pricing" element={<SettingsPage title="Price Settings" />} />
        <Route path="settings/operators" element={<SettingsPage title="Operator Settings" />} />
        <Route path="settings/danger-zone" element={<SettingsPage title="Danger Zone" />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
