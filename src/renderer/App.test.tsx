import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppProviders } from '@/app-providers';
import { AppRoutes } from '@/App';

describe('App', () => {
  it('renders the Today route shell', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/today']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByText('Afterthought')).toBeInTheDocument();
    expect(
      screen.getByText(
        'What has been taking up more space in your mind than you expected?',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish entry' })).toBeInTheDocument();
  });
});
