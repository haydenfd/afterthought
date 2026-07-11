import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const profileSections = [
  {
    title: 'Current priorities',
    items: ['Protecting deeper work blocks', 'Deciding what to build next'],
  },
  {
    title: 'Recurring themes',
    items: ['Ambition with hesitation', 'Energy returning through making things'],
  },
  {
    title: 'Active goals',
    items: ['Clarify the next professional chapter', 'Keep writing daily'],
  },
  {
    title: 'Important relationships',
    items: [
      'A collaborator who helps ideas become concrete',
      'A conversation being delayed',
    ],
  },
  {
    title: 'Open questions',
    items: ['What would make the next step feel chosen rather than reactive?'],
  },
  {
    title: 'Recently changing beliefs',
    items: ['Building small prototypes may be more clarifying than planning longer'],
  },
];

export function ProfilePage() {
  return (
    <section className="mx-auto min-h-screen max-w-5xl px-10 py-10">
      <header className="mb-9 max-w-3xl">
        <p className="text-sm text-muted-foreground">You</p>
        <h1 className="mt-1 text-3xl font-medium">Living profile</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Demonstration data only. Later, this page will be shaped by patterns
          remembered from your entries rather than manually authored placeholders.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {profileSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>Sample profile notes</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="border-l border-border pl-4 writing-text text-lg leading-7"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
