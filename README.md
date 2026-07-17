# Afterthought

Afterthought is a local-first guided reflection app. It helps someone write one
honest entry, remember the parts that matter, and begin the next session with a
question grounded in what they have actually shared before.

The product loop is deliberately small:

```text
write → save locally → index in Supermemory → retrieve relevant memories
     → use Groq to shape a gentle next question → write again
```

Supermemory is the durable memory and retrieval layer. Groq is the adaptive
interpretation layer: it organizes retrieved evidence into questions and threads,
but it is not allowed to invent memories or turn unanswered prompts into facts.

## Current scope

- A focused writing session with two complementary opening questions
- Questions informed by recent entries, Supermemory retrieval, and the cautious profile
- Local JSON persistence under Electron's user-data directory
- Durable, observable Supermemory indexing with startup reconciliation and retry
- A Reflections view with source memories, evidence-backed threads, dates, and source links
- An on-demand temporal mirror that compares earlier and later source moments with citations
- A You view with Supermemory's longitudinal profile and the threads supporting it
- Groq-backed synthesis with explicit unavailable and offline states
- Historical deeper reflections remain readable, but the active writing flow no longer adds a second question
- No authentication, cloud sync, database, rich text, or manual editing of derived memories

## Stack

- Electron and electron-vite
- React, TypeScript, Vite, React Router
- Tailwind CSS with local shadcn/ui-style primitives
- Lucide React and date-fns
- Official `supermemory` TypeScript SDK
- Vitest, ESLint, and Prettier

## Setup

```bash
npm install
npm run dev
```

Groq is optional. To enable generated opening questions and evidence-backed
reflection threads, open **Settings** and paste a Groq API key. Afterthought stores
it with the operating system's secure storage and only shows the final two
characters after saving. Without it, local writing, saving, Supermemory indexing,
and source-memory browsing still work; the adaptive layer explains that it is
unavailable.

Production build:

```bash
npm run build
```

Package installers locally:

```bash
npm run dist
```

## Install from GitHub

Afterthought is distributed through GitHub Releases. Open the latest release and
download the installer for your operating system:

- **macOS**: download the `.dmg` for your Mac (`arm64` for Apple Silicon, `x64`
  for Intel), open it, and drag Afterthought to Applications.
- **Windows**: download the `.exe` installer and run it.
- **Linux**: download the `.AppImage` for a portable app, or the `.deb` for
  Debian/Ubuntu-based distributions.

The current macOS builds are unsigned. If macOS blocks the first launch, open
System Settings > Privacy & Security and allow Afterthought to run.

Checks:

```bash
npm run format:check
npm run typecheck
npm run lint
npm run test
```

## Two-minute demo

For the strongest demo, pre-seed at least three entries on different dates that
touch the same theme. The temporal mirror needs a real earlier/later arc before it
can show meaningful change.

1. Start the app with Supermemory Local available.
2. Open **Settings**, paste a Groq API key, and save it. Confirm that the key is
   shown only as a masked suffix.
3. Write and finish an entry about something present, unresolved, or being tested.
4. Write another entry that revisits the same experience from a different day.
5. Open **Reflections** and wait for **Memory index is ready**. Refresh if the
   document is still processing.
6. Show a thread, its grounded source moments, dates, and **View source entry** links.
7. Ask the temporal mirror something like **What has changed in how I relate to
   uncertainty?** Show **Then**, **Now**, **What shifted**, **Still unresolved**, and
   the source links behind each claim.
8. Open **New Entry**. The opening questions and the compact Supermemory context
   demonstrate the next-session loop.
9. Finish the next entry, then show **You** as the longer portrait and **Reflections**
   as the current evidence.

The key judging moment is not a generic AI summary. It is showing that the second
session is different because the first session became searchable memory, while the
source remains inspectable.

## Supermemory Local

The desktop client connects to:

```text
http://localhost:6767
```

The app attempts to start Supermemory Local when needed. To run it separately:

```bash
npx supermemory local --port 6767
```

Journal entries are stored locally first, then ingested asynchronously into the
container:

```text
afterthought:user:local
```

The ingestion ledger records pending, processing, complete, and failed entries so
the app can reconcile local entries with remote documents after restart. The You
and Reflections pages expose indexing status and offer a retry for failures.

Only authored reflection prose is sent to Supermemory. Opening questions and
unanswered generated prompts are provenance, not memories. An authored historical
follow-up response is included as part of the reflection.

Supermemory Local is optional for journaling. If it is unavailable, the local save
still succeeds and the app reports the offline state without pretending that memory
was indexed.

## Groq's role

When a Groq key is configured in Settings, Groq is used in bounded places:

- Generate two complementary opening questions from recent writing and retrieved memories
- Organize retrieved Supermemory memories into up to four cited reflection threads
- Phrase a gentle next question without diagnosis, certainty, or unsupported patterns

The main process sends current writing and the retrieved context needed for these
tasks. The renderer never receives the API key. Groq output is validated before it
can appear as a thread, and a thread must cite memories returned by Supermemory.

## Architecture

Afterthought is an Electron app with three process boundaries connected only through
a narrow, typed IPC surface:

- **Main process** (`src/main/`) owns the filesystem, Groq calls, and the Supermemory Local client.
- **Preload script** (`src/preload/index.ts`) exposes the typed `window.afterthought` bridge.
- **Renderer** (`src/renderer/`) contains the React UI and never touches Node or the filesystem directly.

Shared types that cross the IPC boundary live in `src/shared/`.

### Writing and indexing

1. `NewEntryPage` requests two cached or generated opening questions.
2. The person writes in one uninterrupted text area and finishes when ready.
3. `entries:create` saves the authored entry atomically under Electron's `userData/entries` directory.
4. `journal-service.ts` starts asynchronous ingestion without delaying the local save.
5. `supermemory-ingestion.ts` sends clean prose with the entry's custom ID and source metadata.
6. The durable ingestion ledger polls Supermemory until the document is complete or records a retryable failure.

### Reading and adapting

1. Opening-question generation combines recent local entries, Supermemory search, and the Supermemory profile.
2. The resulting questions are saved with their source context so the entry can explain why they appeared.
3. Reflections and You read paginated memories and profile data from the `afterthought:user:local` container.
4. Groq receives that bounded context and returns only source-cited threads with gentle optional questions.
5. A temporal mirror query retrieves relevant dated moments, asks Groq to compare earlier and later evidence, and rejects unsupported citations or non-chronological comparisons.
6. The renderer shows the interpretation alongside the source memory and a link back to the local journal entry.

### Design principle

**Local-first, evidence-bound continuity.** The journal is the durable user-owned
artifact. Supermemory provides persistent extraction and retrieval. Groq provides
bounded language synthesis. Each layer can fail without turning a person's writing
into a failed save or an unsupported conclusion.

## Routes

- `/entry/new`: focused guided reflection session
- `/calendar`: archive of saved entries
- `/calendar/:date`: entry detail with prompt and memory provenance
- `/reflections`: current source memories, evidence-backed threads, and the temporal mirror
- `/profile`: cautious longitudinal profile and supporting threads
- `/settings`: appearance, local memory URL, connection, and privacy context
- `/`: redirects to onboarding

## Privacy and intentional boundaries

- Journal entries are local JSON files and are not encrypted or synced yet.
- Supermemory Local stores extracted memories on the configured local service.
- If Groq is configured, current writing and retrieved context are sent to Groq to generate questions and threads.
- Derived profile lines and threads are read-only views; they do not overwrite the journal.
- Afterthought is guided reflection software, not a diagnostic tool or a replacement for professional care.
- There is no authentication, cloud account, backend server, or multi-device sync.

The app prioritizes a coherent source-backed continuity loop over adding unrelated
AI surfaces.
