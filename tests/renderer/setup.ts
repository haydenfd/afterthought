import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'afterthought', {
  writable: true,
  configurable: true,
  value: {
    platform: 'test',
    versions: { chrome: undefined, electron: undefined },
    supermemory: {
      checkConnection: vi.fn().mockResolvedValue({ status: 'offline', url: '' }),
    },
    entries: {
      create: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([]),
    },
    memory: {
      refresh: vi.fn().mockResolvedValue({
        status: 'offline',
        profile: { static: [], dynamic: [] },
        memories: [],
      }),
    },
    preferences: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue({}),
    },
    reflection: {
      openingQuestions: vi
        .fn()
        .mockResolvedValue({ questions: null, source: 'fallback' }),
    },
  },
});
