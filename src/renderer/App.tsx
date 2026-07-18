import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { AppProviders } from '@/app-providers';
import { AppShell } from '@/components/layout/app-shell';
import { CalendarPage } from '@/routes/calendar-page';
import { EntryDetailPage } from '@/routes/entry-detail-page';
import { NewEntryPage } from '@/routes/new-entry-page';
import { OnboardingPage } from '@/routes/onboarding-page';
import { ReflectionsPage } from '@/routes/reflections-page';
import { SettingsPage } from '@/routes/settings-page';
import { DraftProvider } from '@/state/draft-context';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<AppShell />}>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/calendar/:date" element={<EntryDetailPage />} />
        <Route path="/reflections" element={<ReflectionsPage />} />
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

function RootRedirect() {
  const [destination, setDestination] = useState<'/onboarding' | '/calendar' | null>(
    null,
  );

  useEffect(() => {
    let isCurrent = true;

    void Promise.all([
      window.afterthought.preferences.get(),
      window.afterthought.groq.validateApiKey(),
    ]).then(([preferences, groqStatus]) => {
      if (!isCurrent) {
        return;
      }

      setDestination(
        preferences.onboardingCompletedAt && groqStatus.valid === true
          ? '/calendar'
          : '/onboarding',
      );
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  return destination ? (
    <Navigate to={destination} replace />
  ) : (
    <main className="min-h-screen bg-background" aria-label="Loading Afterthought" />
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
