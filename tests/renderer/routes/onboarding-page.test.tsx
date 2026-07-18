import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppProviders } from '@/app-providers';
import { AppRoutes } from '@/App';

function renderOnboarding() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/onboarding']}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('OnboardingPage', () => {
  it('starts on the welcome slide and advances to the writing slide', () => {
    renderOnboarding();

    expect(
      screen.getByRole('heading', { name: 'Welcome to Afterthought' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Skip onboarding' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByRole('heading', { name: 'Write without performing' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
  });

  it('moves backward to the previous slide', () => {
    renderOnboarding();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));

    expect(
      screen.getByRole('heading', { name: 'Welcome to Afterthought' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
  });

  it('requires and saves a Groq key before opening Calendar', async () => {
    renderOnboarding();

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    }

    expect(
      screen.getByRole('heading', { name: 'Add your Groq key' }),
    ).toBeInTheDocument();
    const openButton = screen.getByRole('button', {
      name: 'Verify key and open Calendar',
    });
    expect(openButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Groq API key'), {
      target: { value: 'gsk_test-secret' },
    });
    fireEvent.click(openButton);

    expect(await screen.findByText(/entries this month/)).toBeInTheDocument();
    expect(window.afterthought.groq.setApiKey).toHaveBeenCalledWith('gsk_test-secret');
    const preferenceUpdates = vi
      .mocked(window.afterthought.preferences.set)
      .mock.calls.map(([update]) => update);
    expect(
      preferenceUpdates.some(
        (update) => typeof update.onboardingCompletedAt === 'string',
      ),
    ).toBe(true);
  });
});
