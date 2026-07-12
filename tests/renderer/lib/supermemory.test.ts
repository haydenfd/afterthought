import { createAfterthoughtSupermemoryClient } from '@/lib/supermemory';

describe('AfterthoughtSupermemoryClient', () => {
  it('returns offline when Supermemory Local cannot be reached', async () => {
    const originalAfterthought = window.afterthought;
    // @ts-expect-error -- simulate a plain browser context with no Electron bridge
    delete window.afterthought;

    try {
      const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
      const client = createAfterthoughtSupermemoryClient('http://localhost:6767', {
        fetchFn,
        timeoutMs: 10,
      });

      await expect(client.checkConnection()).resolves.toMatchObject({
        status: 'offline',
        url: 'http://localhost:6767',
      });
    } finally {
      window.afterthought = originalAfterthought;
    }
  });

  it('does not throw for invalid local URLs', async () => {
    const client = createAfterthoughtSupermemoryClient('not a url');

    await expect(client.checkConnection()).resolves.toMatchObject({
      status: 'offline',
      url: 'not a url',
    });
  });
});
