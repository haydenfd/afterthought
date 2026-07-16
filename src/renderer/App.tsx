import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppProviders } from '@/app-providers';
import { AppShell } from '@/components/layout/app-shell';
import { CalendarPage } from '@/routes/calendar-page';
import { EntryDetailPage } from '@/routes/entry-detail-page';
import { NewEntryPage } from '@/routes/new-entry-page';
import { OnboardingPage } from '@/routes/onboarding-page';
import { ProfilePage } from '@/routes/profile-page';
import { ReflectionsPage } from '@/routes/reflections-page';
import { SettingsPage } from '@/routes/settings-page';
import { DraftProvider } from '@/state/draft-context';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/onboarding" replace />} />
      <Route element={<AppShell />}>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/calendar/:date" element={<EntryDetailPage />} />
        <Route path="/reflections" element={<ReflectionsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="/entry/new"
        element={
          <DraftProvider>
            <NewEntryPage />
          </DraftProvider>
        }
      />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="*" element={<Navigate to="/calendar" replace />} />
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
