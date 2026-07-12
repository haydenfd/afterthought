import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  createAfterthoughtSupermemoryClient,
  DEFAULT_SUPERMEMORY_URL,
  type ConnectionCheckResult,
  type SupermemoryConnectionStatus,
} from '@/lib/supermemory';

interface SupermemoryState {
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  status: SupermemoryConnectionStatus;
  lastCheckedAt: Date | null;
  connectionMessage: string | null;
  testConnection: () => Promise<ConnectionCheckResult>;
}

const SupermemoryContext = createContext<SupermemoryState | null>(null);

export function SupermemoryProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_SUPERMEMORY_URL);
  const [status, setStatus] = useState<SupermemoryConnectionStatus>('checking');
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void window.afterthought.preferences.get().then((preferences) => {
      if (isCurrent && preferences.supermemoryUrl) {
        setBaseUrlState(preferences.supermemoryUrl);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const setBaseUrl = useCallback((value: string): void => {
    setBaseUrlState(value);
    setStatus('checking');
    setConnectionMessage(null);
    void window.afterthought.preferences.set({ supermemoryUrl: value });
  }, []);

  const testConnection = useCallback(async (): Promise<ConnectionCheckResult> => {
    setStatus('checking');
    const result = await createAfterthoughtSupermemoryClient(baseUrl).checkConnection();
    setStatus(result.status);
    setLastCheckedAt(result.checkedAt);
    setConnectionMessage(result.message ?? null);
    return result;
  }, [baseUrl]);

  useEffect(() => {
    let isMounted = true;

    void createAfterthoughtSupermemoryClient(baseUrl)
      .checkConnection()
      .then((result) => {
        if (isMounted) {
          setStatus(result.status);
          setLastCheckedAt(result.checkedAt);
          setConnectionMessage(result.message ?? null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [baseUrl]);

  const value = useMemo<SupermemoryState>(
    () => ({
      baseUrl,
      setBaseUrl,
      status,
      lastCheckedAt,
      connectionMessage,
      testConnection,
    }),
    [baseUrl, setBaseUrl, status, lastCheckedAt, connectionMessage, testConnection],
  );

  return (
    <SupermemoryContext.Provider value={value}>{children}</SupermemoryContext.Provider>
  );
}

export function useSupermemory(): SupermemoryState {
  const context = useContext(SupermemoryContext);

  if (!context) {
    throw new Error('useSupermemory must be used within SupermemoryProvider');
  }

  return context;
}
