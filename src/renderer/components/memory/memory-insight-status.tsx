import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MemoryInsightSummary } from '../../../shared/memory';

export function MemoryInsightStatus({
  insights,
}: {
  insights?: MemoryInsightSummary | undefined;
}) {
  if (!insights?.message) {
    return null;
  }

  return (
    <section
      className={cn(
        'rounded-lg border bg-card/45 p-4',
        insights.status === 'unavailable' && 'border-border',
      )}
      aria-live="polite"
      aria-label="Adaptive reflection status"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Groq reflection layer
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{insights.message}</p>
        </div>
      </div>
    </section>
  );
}
