import { afterEach, describe, expect, it, vi } from 'vitest';

import { callGroq } from '../../src/main/groq-client';

const originalFetch = global.fetch;
const originalApiKey = process.env.GROQ_API_KEY;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) {
    delete process.env.GROQ_API_KEY;
  } else {
    process.env.GROQ_API_KEY = originalApiKey;
  }
});

describe('callGroq', () => {
  it('returns null when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;
    global.fetch = vi.fn();

    await expect(callGroq([{ role: 'user', content: 'hi' }])).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the message content on a successful response', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '["Question one?", "Question two?"]' } }],
        }),
    });

    await expect(callGroq([{ role: 'user', content: 'hi' }])).resolves.toBe(
      '["Question one?", "Question two?"]',
    );
  });

  it('returns null on a non-2xx response', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(callGroq([{ role: 'user', content: 'hi' }])).resolves.toBeNull();
  });

  it('returns null when the response has no message content', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    });

    await expect(callGroq([{ role: 'user', content: 'hi' }])).resolves.toBeNull();
  });

  it('returns null on a network failure', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(callGroq([{ role: 'user', content: 'hi' }])).resolves.toBeNull();
  });

  it('requests JSON mode when jsonMode is set', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '{}' } }] }),
    });
    global.fetch = fetchMock;

    await callGroq([{ role: 'user', content: 'hi' }], { jsonMode: true });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as Record<string, unknown>;
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});
