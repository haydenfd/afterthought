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
  SUPERMEMORY_LOCAL_URL,
  type SupermemoryConnectionResult,
  type SupermemoryConnectionStatus,
} from '../../shared/supermemory';
type ConnectionCheckResult = SupermemoryConnectionResult & { checkedAt: Date };

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
  const [baseUrl, setBaseUrlState] = useState(SUPERMEMORY_LOCAL_URL);
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
    const result = await window.afterthought.supermemory.checkConnection(baseUrl);
    const checkedAt = new Date();
    setStatus(result.status);
    setLastCheckedAt(checkedAt);
    setConnectionMessage(result.message ?? null);
    return { ...result, checkedAt };
  }, [baseUrl]);

  useEffect(() => {
    let isMounted = true;
    let pollTimeout: ReturnType<typeof setTimeout> | undefined;

    const poll = () => {
      void window.afterthought.supermemory.checkConnection(baseUrl).then((result) => {
        if (!isMounted) {
          return;
        }

        setStatus(result.status);
        setLastCheckedAt(new Date());
        setConnectionMessage(result.message ?? null);

        // Supermemory Local may still be installing/starting in the
        // background — keep polling until it settles one way or the other.
        if (result.status === 'starting') {
          pollTimeout = setTimeout(poll, 3_000);
        }
      });
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(pollTimeout);
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
