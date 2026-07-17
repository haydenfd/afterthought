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

  it('opens Calendar after the final slide', async () => {
    renderOnboarding();

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    }

    expect(
      screen.getByRole('heading', { name: 'Make a little room for yourself' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Calendar' }));

    expect(await screen.findByText(/entries this month/)).toBeInTheDocument();
  });
});
