# Afterthought

Afterthought is a local-first guided reflection app. It remembers completed
reflections so it can offer more relevant questions and cautiously surface what
appears to be recurring, steady, or changing over time.

## Current Scope

The current vertical slice includes:

- Secure Electron app structure with main, preload, and React renderer processes
- Calm writing flow with two complementary opening questions
- One optional, generated deeper question per reflection
- Local JSON journal entry persistence in Electron user data
- Best-effort ingestion of completed entries into Supermemory Local
- Live local memory and profile inspection in Reflections
- Groq-backed structured question planning with offline fallbacks
- Automatically inferred themes used for retrieval and repetition avoidance
- No authentication, database, synchronization, or manual tagging

## Stack

- Electron and electron-vite
- React, TypeScript, Vite, React Router
- Tailwind CSS with shadcn/ui-style local primitives
- Lucide React and date-fns
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

Package installers locally:

```bash
npm run dist
```

## Install from GitHub

Afterthought is distributed through GitHub Releases. Open the latest release,
then download the installer for your operating system:

- **macOS**: download the `.dmg` for your Mac (`arm64` for Apple Silicon, `x64`
  for Intel), open it, and drag Afterthought to Applications.
- **Windows**: download the `.exe` installer and run it.
- **Linux**: download the `.AppImage` for a portable app, or the `.deb` for
  Debian/Ubuntu-based distributions.

The current macOS builds are unsigned. If macOS blocks the first launch, open
System Settings > Privacy & Security and allow Afterthought to run.

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
unavailable, the Settings page shows an offline state without
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
  object with narrow `entries`, `memory`, `preferences`, `reflection`, and
  `supermemory` namespaces. `contextIsolation` and `sandbox` are on and
  `nodeIntegration` is off, so the renderer cannot touch Node or Electron APIs
  directly — everything goes through this typed surface.
- **Renderer** (`src/renderer/`) — a normal React 19 + React Router SPA. Routes
  live in `src/renderer/routes/`, and components are split by role:
  `src/renderer/components/layout/` (app shell, sidebar), `.../components/supermemory/`
  (Supermemory-specific UI), and `.../components/ui/` (shadcn/ui-style primitives).
  Cross-page state (draft text, theme, Supermemory status) lives in
  `src/renderer/state/` via React context.

Shared types that cross the IPC boundary (`JournalEntry`, `MemoryProfile`, etc.)
live in `src/shared/` so main and renderer never drift out of sync.

Tests live outside `src/`, in `tests/`, mirroring the source tree (e.g.
`src/main/entry-storage.ts` is covered by `tests/main/entry-storage.test.ts`).

### Data flow: writing an entry

1. `NewEntryPage` loads two cached or generated opening questions without reacting
   to keystrokes. The person writes in one uninterrupted initial area.
2. The person can finish immediately or select **Go deeper**. That explicit action
   asks the main process for one follow-up; there is no conversational loop.
3. The deeper-question service interprets the current writing, plans targeted
   retrieval, filters weak Supermemory matches, and asks Groq for one structured
   question. It can ignore memory entirely and has a local fallback.
4. `NewEntryPage` calls `window.afterthought.entries.create(...)` with the complete
   guided session.
5. Preload forwards this over IPC to the `entries:create` handler in `src/main/index.ts`.
6. `journal-service.ts` calls `entry-storage.ts`, which writes the entry as local
   JSON under Electron's `userData/entries` directory. This save is synchronous
   with the UI response — it's the durable source of truth.
7. `journal-service.ts` then fires an **async, best-effort** call into
   `supermemory-ingestion.ts`, which sends clean prose containing the opening
   context, initial writing, and optional deeper exchange. Failures never block
   or fail the local save.

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

- `/entry/new`: focused guided reflection screen
- `/calendar`: month calendar of saved entries
- `/calendar/:date`: saved entry detail view
- `/reflections`: concrete remembered moments from completed reflections
- `/profile`: cautious synthesized profile from the local memory service
- `/settings`: appearance and Supermemory Local settings
- `/`: redirects to `/calendar`

## Current Limitations

- Journal entries are local JSON files only; they are not encrypted or synced
- Supermemory processing can take a short time after an entry is saved
- No markdown, rich text, backend server, database, authentication, or syncing

## Planned Next Steps

- Add local encrypted journal storage
- Improve recovery/retry visibility for best-effort memory ingestion
- Add stronger source-date provenance as Supermemory exposes it in search results
- Add import/export and backup flows
