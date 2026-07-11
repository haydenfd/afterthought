import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatFullDate, parseRouteDate } from '@/lib/dates';

const originalPrompt =
  'What has been taking up more space in your mind than you expected?';
const followUpQuestion = 'What part of this feels unresolved?';

export function EntryDetailPage() {
  const { date } = useParams();
  const parsedDate = parseRouteDate(date);

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <Button variant="ghost" asChild>
        <Link to="/calendar">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Calendar
        </Link>
      </Button>

      <header className="mt-8">
        <p className="text-sm text-muted-foreground">Sample journal entry</p>
        <h1 className="mt-1 text-3xl font-medium">
          {parsedDate ? formatFullDate(parsedDate) : 'Unknown date'}
        </h1>
      </header>

      <div className="mt-8 space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Original prompt
            </p>
            <p className="mt-3 writing-text text-2xl leading-9">{originalPrompt}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Placeholder journal content
            </p>
            <p className="mt-4 writing-text text-xl leading-9 text-foreground/90">
              I kept circling back to the same decision today. It was not urgent,
              exactly, but it kept shaping the background of everything else I tried to
              do. Naming it made it feel less abstract.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Placeholder follow-up
            </p>
            <p className="mt-3 writing-text text-2xl leading-9">{followUpQuestion}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
