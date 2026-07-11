import { Circle, LoaderCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { type SupermemoryConnectionStatus } from '@/lib/supermemory';

const statusLabel: Record<SupermemoryConnectionStatus, string> = {
  checking: 'Checking',
  connected: 'Connected',
  offline: 'Offline',
};

export function SupermemoryStatus({
  status,
  compact = false,
}: {
  status: SupermemoryConnectionStatus;
  compact?: boolean;
}) {
  const isChecking = status === 'checking';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-border bg-background/65 px-2.5 py-1.5 text-xs text-muted-foreground',
        compact && 'w-full justify-start',
      )}
      title={`Supermemory Local: ${statusLabel[status]}`}
    >
      {isChecking ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Circle
          className={cn(
            'h-2.5 w-2.5 fill-current',
            status === 'connected' ? 'text-primary' : 'text-muted-foreground',
          )}
          aria-hidden="true"
        />
      )}
      <span>Supermemory {statusLabel[status]}</span>
    </div>
  );
}
