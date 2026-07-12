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

## Architecture

Afterthought is an Electron app with three process boundaries, connected only
through a narrow, typed IPC surface:

- **Main process** (`src/main/`) — Node-side logic. Owns the filesystem and the
  Supermemory Local HTTP client. Nothing here is reachable from the renderer
  except through the IPC handlers registered in `src/main/index.ts`.
- **Preload script** (`src/preload/index.ts`) — the only bridge between the two.
  Uses `contextBridge.exposeInMainWorld` to expose a single `window.afterthought`
  object with `entries`, `memory`, and `supermemory` namespaces. `contextIsolation`
  and `sandbox` are on and `nodeIntegration` is off, so the renderer cannot touch
  Node or Electron APIs directly — everything goes through this typed surface.
- **Renderer** (`src/renderer/`) — a normal React 19 + React Router SPA. Routes
  live in `src/renderer/routes/`, shared chrome (sidebar, collapsible shell) in
  `src/renderer/components/`, and cross-page state (draft text, theme, Supermemory
  status) in `src/renderer/state/` via React context.

Shared types that cross the IPC boundary (`JournalEntry`, `MemoryProfile`, etc.)
live in `src/shared/` so main and renderer never drift out of sync.

### Data flow: writing an entry

1. `TodayPage` collects prompt/content and calls `window.afterthought.entries.create(...)`.
2. Preload forwards this over IPC to the `entries:create` handler in `src/main/index.ts`.
3. `journal-service.ts` calls `entry-storage.ts`, which writes the entry as local
   JSON under Electron's `userData/entries` directory. This save is synchronous
   with the UI response — it's the durable source of truth.
4. `journal-service.ts` then fires an **async, best-effort** call into
   `supermemory-ingestion.ts`, which pushes the entry's content into Supermemory
   Local under the `afterthought:user:local` container tag. Failures here are
   caught and logged only — they never block or fail the save (see the
   `.catch()` in `journal-service.ts`).

### Data flow: reading memories back

`memory-service.ts` calls Supermemory Local's `/v4/memories/list` (paginated) and
`profile` endpoints, normalizes whatever shape comes back (the code defensively
handles a few possible response shapes), and returns a `MemoryRefreshResult` with
an explicit `online`/`offline` status. `ReflectionsPage` renders this, so the UI
degrades gracefully — the app is always usable even with Supermemory Local down,
by design (see `checkSupermemoryConnection` in `src/main/index.ts`, which never
throws, just reports offline).

### Key design principle

**Local-first, memory-service-optional.** Journal entries are the durable local
artifact; Supermemory Local is a value-add layer that's allowed to be down,
slow, or wrong without taking the journaling flow down with it. Nearly every
Supermemory-touching function in the codebase is written to fail soft and return
a typed offline/error state rather than throw.

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
