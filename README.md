# Afterthought

Afterthought is an early desktop shell for a reflective journaling product. The
eventual app will help people write daily entries, ask better follow-up
questions over time, and build a living understanding of recurring themes,
beliefs, goals, and changes.

## Current Scope

This scaffold focuses on the initial desktop writing experience only:

- Secure Electron app structure with main, preload, and React renderer processes
- Calm journaling shell with Today, Calendar, Reflections, You, and Settings
- Local JSON journal entry persistence in Electron user data
- Best-effort ingestion of completed entries into Supermemory Local
- Live local memory and profile inspection in Reflections
- No AI generation, authentication, or database

## Stack

- Electron and electron-vite
- React, TypeScript, Vite, React Router
- Tailwind CSS with shadcn/ui-style local primitives
- Lucide React, date-fns, Zod
- Official `supermemory` TypeScript SDK
- Vitest, ESLint, Prettier

## Setup

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
```

## Supermemory Local

The desktop client connects to:

```text
http://localhost:6767
```

To run Supermemory Local separately:

```bash
npx supermemory local --port 6767
```

The app does not require Supermemory Local to be running. If the local service is
unavailable, the Settings page and sidebar show an offline state without
blocking the journaling UI.

Completed entries are saved to local JSON first, then sent asynchronously to the
`afterthought:user:local` container. A failed or unavailable memory service never
blocks the local journal save. Reflections can refresh the extracted memories and
profile, and remains usable in a quiet offline state.

## Routes

- `/today`: daily writing screen
- `/calendar`: month calendar of saved entries
- `/calendar/:date`: saved entry detail view
- `/reflections`: live local memories with clearly labeled examples
- `/profile`: demonstration living profile
- `/settings`: appearance and Supermemory Local settings
- `/`: redirects to `/today`

## Current Limitations

- Journal entries are local JSON files only; they are not encrypted or synced
- The You profile content remains demonstration data
- Supermemory processing can take a short time after an entry is saved
- No markdown, rich text, backend server, database, authentication, or syncing

## Planned Next Steps

- Add local encrypted journal storage
- Retrieve relevant prior memories for follow-up prompts
- Replace demonstration profile and reflection data with accumulated memory
- Add import/export and backup flows
