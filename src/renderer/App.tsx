import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppProviders } from '@/app-providers';
import { AppShell } from '@/components/layout/app-shell';
import { CalendarPage } from '@/routes/calendar-page';
import { EntryDetailPage } from '@/routes/entry-detail-page';
import { ProfilePage } from '@/routes/profile-page';
import { ReflectionsPage } from '@/routes/reflections-page';
import { SettingsPage } from '@/routes/settings-page';
import { TodayPage } from '@/routes/today-page';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route element={<AppShell />}>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/calendar/:date" element={<EntryDetailPage />} />
        <Route path="/reflections" element={<ReflectionsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
