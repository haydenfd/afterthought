import { AlertCircle, CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MemoryIngestionSummary } from '../../../shared/memory';

export function MemoryIndexStatus({
  ingestion,
  isRetrying = false,
  onRetry,
}: {
  ingestion?: MemoryIngestionSummary | undefined;
  isRetrying?: boolean;
  onRetry?: () => void;
}) {
  if (!ingestion) {
    return null;
  }

  const isAttention = ingestion.status === 'attention';
  const isProcessing = ingestion.status === 'processing';
  const Icon = isAttention ? AlertCircle : isProcessing ? LoaderCircle : CheckCircle2;
  const title = isAttention
    ? 'Some reflections need attention'
    : isProcessing
      ? 'Memory is still catching up'
      : ingestion.complete > 0
        ? 'Memory index is ready'
        : 'Memory index is ready for your first reflection';

  return (
    <section
      className={cn(
        'rounded-lg border bg-card/65 p-4',
        isAttention && 'border-primary/45',
      )}
      aria-live="polite"
      aria-label="Memory indexing status"
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground',
            isAttention && 'text-primary',
            isProcessing && 'animate-spin motion-reduce:animate-none',
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {ingestion.message ?? 'Your saved reflections stay on this machine.'}
          </p>
          {isAttention && onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={isRetrying}
              onClick={onRetry}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {isRetrying ? 'Retrying…' : 'Retry indexing'}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
