import { createAfterthoughtSupermemoryClient } from '@/lib/supermemory';

describe('AfterthoughtSupermemoryClient', () => {
  it('returns offline when Supermemory Local cannot be reached', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const client = createAfterthoughtSupermemoryClient('http://localhost:6767', {
      fetchFn,
      timeoutMs: 10,
    });

    await expect(client.checkConnection()).resolves.toMatchObject({
      status: 'offline',
      url: 'http://localhost:6767',
    });
  });

  it('does not throw for invalid local URLs', async () => {
    const client = createAfterthoughtSupermemoryClient('not a url');

    await expect(client.checkConnection()).resolves.toMatchObject({
      status: 'offline',
      url: 'not a url',
    });
  });
});
