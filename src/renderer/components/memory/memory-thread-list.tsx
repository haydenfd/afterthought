import type { MemoryThread } from '../../../shared/memory';

const kindLabels: Record<MemoryThread['kind'], string> = {
  present: 'Present now',
  unresolved: 'Still open',
  shifting: 'In motion',
  steady: 'Holding steady',
  progress: 'A small change',
};

export function MemoryThreadList({ threads }: { threads: MemoryThread[] }) {
  return (
    <div className="space-y-5">
      {threads.map((thread) => (
        <article
          key={thread.id}
          className="rounded-lg border border-border bg-card/55 p-5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {kindLabels[thread.kind]}
            </p>
            <span className="text-xs text-muted-foreground/60" aria-hidden="true">
              ·
            </span>
            <p className="text-xs text-muted-foreground">
              {thread.sourceMemoryIds.length}{' '}
              {thread.sourceMemoryIds.length === 1 ? 'source moment' : 'source moments'}
            </p>
          </div>
          <h3 className="mt-3 text-xl font-medium">{thread.title}</h3>
          <p className="mt-3 max-w-2xl writing-text text-lg leading-8 text-foreground/90">
            {thread.summary}
          </p>
          {thread.nextQuestion ? (
            <p className="mt-4 max-w-2xl border-l border-primary/45 pl-4 writing-text text-lg italic leading-8 text-muted-foreground">
              {thread.nextQuestion}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
