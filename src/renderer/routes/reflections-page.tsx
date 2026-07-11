import { Feather } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const reflections = [
  'You have mentioned uncertainty about your next career step several times this month.',
  'Your entries sound more energized when you discuss building than when you discuss applying.',
  'Sleep has appeared less often as a concern over the last two weeks.',
  'A conversation you have been postponing remains unresolved.',
];

export function ReflectionsPage() {
  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-9">
        <p className="text-sm text-muted-foreground">Reflections</p>
        <h1 className="mt-1 text-3xl font-medium">Longer patterns</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Demonstration reflections are shown here. Real reflections will develop from
          accumulated journal memory once storage and Supermemory Local flows are
          connected.
        </p>
      </header>

      <div className="space-y-4">
        {reflections.map((reflection) => (
          <Card key={reflection}>
            <CardContent className="flex gap-4 p-5">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Feather className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="writing-text text-xl leading-8">{reflection}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-dashed bg-background/55">
        <CardHeader>
          <CardTitle>Waiting for real journal memory</CardTitle>
          <CardDescription>
            This screen is intentionally quiet for now. It will become useful only after
            entries, themes, and changes can be remembered over time.
          </CardDescription>
        </CardHeader>
      </Card>
    </section>
  );
}
