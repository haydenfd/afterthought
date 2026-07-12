import { describe, expect, it } from 'vitest';

import { resolveSupermemoryUrl } from '../../src/main/supermemory-client';
import { SUPERMEMORY_LOCAL_URL } from '../../src/shared/supermemory';

describe('Supermemory client configuration', () => {
  it('uses the saved URL when one is configured', () => {
    expect(resolveSupermemoryUrl({ supermemoryUrl: ' http://127.0.0.1:6767/ ' })).toBe(
      'http://127.0.0.1:6767/',
    );
  });

  it('falls back to the local default when the saved URL is empty', () => {
    expect(resolveSupermemoryUrl({ supermemoryUrl: '   ' })).toBe(
      SUPERMEMORY_LOCAL_URL,
    );
    expect(resolveSupermemoryUrl({})).toBe(SUPERMEMORY_LOCAL_URL);
  });
});
