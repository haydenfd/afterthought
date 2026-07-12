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
- Placeholder Supermemory Local connection indicator and typed client methods
- No AI generation, memory retrieval, authentication, or database

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

The placeholder client defaults to:

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

The placeholder client lives in `src/renderer/lib/supermemory.ts` and exposes:

- `checkConnection`
- `addJournalEntry`
- `searchMemories`
- `getProfile`

Only `checkConnection` performs a lightweight local availability check today.
The other methods are typed placeholders for later product work.

## Routes

- `/today`: daily writing screen
- `/calendar`: month calendar of saved entries
- `/calendar/:date`: saved entry detail view
- `/reflections`: example longitudinal reflections
- `/profile`: demonstration living profile
- `/settings`: appearance and Supermemory Local settings
- `/`: redirects to `/today`

## Current Limitations

- Journal entries are local JSON files only; they are not encrypted or synced
- Reflections and profile content are demonstration data
- Supermemory writes, searches, and profile retrieval are not implemented
- No markdown, rich text, backend server, database, authentication, or syncing

## Planned Next Steps

- Add local encrypted journal storage
- Connect completed entries to Supermemory Local
- Retrieve relevant prior memories for follow-up prompts
- Replace demonstration profile and reflection data with accumulated memory
- Add import/export and backup flows
