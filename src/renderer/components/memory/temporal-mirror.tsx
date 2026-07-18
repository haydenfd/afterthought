import { Clock3, Search } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatFullDate, formatRouteDate } from '@/lib/dates';
import type { JournalEntry } from '../../../shared/journal-entry';
import type {
  MemoryEvidenceItem,
  TemporalMirrorResult,
  TemporalMirrorSection,
} from '../../../shared/reflection';

export function TemporalMirror({
  entriesById,
}: {
  entriesById: Map<string, JournalEntry>;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<TemporalMirrorResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return;
    }

    setIsLoading(true);
    try {
      setResult(await window.afterthought.reflection.temporalMirror(normalizedQuery));
    } catch {
      setResult({
        status: 'unavailable',
        query: normalizedQuery,
        message:
          'The temporal reflection layer could not be reached. Try again shortly.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-secondary p-2 text-muted-foreground">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <CardTitle>Temporal Mirror</CardTitle>
            <CardDescription>
              Ask about something to see how it progresses over time.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="temporal-mirror-question">Ask your journal</Label>
            <Input
              id="temporal-mirror-question"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What has changed in how I relate to uncertainty?"
              disabled={isLoading}
              spellCheck
            />
          </div>
          <Button type="submit" disabled={!query.trim() || isLoading}>
            <Search className="h-4 w-4" aria-hidden="true" />
            {isLoading ? 'Looking…' : 'Compare moments'}
          </Button>
        </form>

        {result?.status === 'available' ? (
          <TemporalMirrorResultView result={result} entriesById={entriesById} />
        ) : result ? (
          <p
            className="rounded-lg border border-border bg-background/55 p-4 text-sm leading-6 text-muted-foreground"
            role="status"
          >
            {result.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TemporalMirrorResultView({
  result,
  entriesById,
}: {
  result: Extract<TemporalMirrorResult, { status: 'available' }>;
  entriesById: Map<string, JournalEntry>;
}) {
  const memoriesById = new Map(
    result.sourceMemories.map((memory) => [memory.id, memory]),
  );

  return (
    <div className="space-y-5" aria-live="polite">
      <div className="border-b border-border/75 pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Temporal Mirror
        </p>
        <p className="mt-2 writing-text text-lg leading-8">“{result.query}”</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MirrorSection
          label="Then"
          section={result.then}
          memoriesById={memoriesById}
          entriesById={entriesById}
        />
        <MirrorSection
          label="Now"
          section={result.now}
          memoriesById={memoriesById}
          entriesById={entriesById}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MirrorTextSection label="What shifted" text={result.shifted} />
        <MirrorTextSection label="Still unresolved" text={result.unresolved} />
      </div>
    </div>
  );
}

function MirrorSection({
  label,
  section,
  memoriesById,
  entriesById,
}: {
  label: string;
  section: TemporalMirrorSection;
  memoriesById: Map<string, MemoryEvidenceItem>;
  entriesById: Map<string, JournalEntry>;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/45 p-4">
      <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h3>
      <p className="mt-3 writing-text text-lg leading-8 text-foreground/90">
        {section.summary}
      </p>
      <SourceList
        memoryIds={section.sourceMemoryIds}
        memoriesById={memoriesById}
        entriesById={entriesById}
      />
    </section>
  );
}

function MirrorTextSection({ label, text }: { label: string; text: string }) {
  return (
    <section className="border-l border-primary/45 pl-4">
      <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h3>
      <p className="mt-2 writing-text text-lg leading-8 text-foreground/90">{text}</p>
    </section>
  );
}

function SourceList({
  memoryIds,
  memoriesById,
  entriesById,
}: {
  memoryIds: string[];
  memoriesById: Map<string, MemoryEvidenceItem>;
  entriesById: Map<string, JournalEntry>;
}) {
  const sources = memoryIds
    .map((memoryId) => memoriesById.get(memoryId))
    .filter((memory): memory is MemoryEvidenceItem => Boolean(memory));

  return (
    <ul className="mt-4 space-y-3 border-t border-border/75 pt-3">
      {sources.map((memory) => (
        <li key={memory.id} className="text-xs leading-5 text-muted-foreground">
          <SourceReference memory={memory} entriesById={entriesById} />
        </li>
      ))}
    </ul>
  );
}

function SourceReference({
  memory,
  entriesById,
}: {
  memory: MemoryEvidenceItem;
  entriesById: Map<string, JournalEntry>;
}) {
  const sourceEntry = memory.sourceEntryIds
    .map((entryId) => entriesById.get(entryId))
    .find((entry): entry is JournalEntry => Boolean(entry));
  const sourceDate = sourceEntry?.createdAt ?? memory.sourceDate;

  return sourceDate ? (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground/75">
      <span>{formatMemoryDate(sourceDate)}</span>
      {sourceEntry ? (
        <>
          <span aria-hidden="true">·</span>
          <Link
            to={`/calendar/${formatRouteDate(new Date(sourceEntry.createdAt))}`}
            className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            View source entry
          </Link>
        </>
      ) : null}
    </div>
  ) : null;
}

function formatMemoryDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatFullDate(parsed);
}
