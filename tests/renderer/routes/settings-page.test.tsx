import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppProviders } from '@/app-providers';
import { SettingsPage } from '@/routes/settings-page';

const initialAfterthoughtApi = window.afterthought;

describe('SettingsPage', () => {
  afterEach(() => {
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: initialAfterthoughtApi,
    });
  });

  it('saves a Groq key and keeps it visible until editing is requested', async () => {
    const setApiKey = vi.fn().mockResolvedValue({
      configured: true,
      secureStorageAvailable: true,
      maskedKey: '••••••••ey',
    });
    const currentApi = window.afterthought;
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: {
        ...currentApi,
        groq: {
          ...currentApi.groq,
          getStatus: vi.fn().mockResolvedValue({
            configured: false,
            secureStorageAvailable: true,
          }),
          setApiKey,
        },
      },
    });

    render(
      <AppProviders>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </AppProviders>,
    );

    const input = await screen.findByLabelText('API key');
    fireEvent.change(input, { target: { value: 'gsk_test-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }));

    await waitFor(() => expect(setApiKey).toHaveBeenCalledWith('gsk_test-secret'));
    expect(screen.getByDisplayValue('gsk_test-secret')).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Groq API key' }));
    expect(screen.getByDisplayValue('gsk_test-secret')).not.toHaveAttribute('readonly');
  });
});
