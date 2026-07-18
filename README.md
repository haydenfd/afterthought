# Afterthought

Afterthought is a local-first guided journal that helps you notice what is on
your mind and see how it changes over time.

## The idea

Most journaling captures a moment and leaves it behind. Afterthought turns past
entries into useful continuity for the next session without becoming a chatbot,
a task manager, or a diagnostic tool.

## The loop

1. Add a Groq API key during onboarding. Groq is the app's reflection layer.
2. Write a short entry.
3. Supermemory indexes the authored reflection.
4. Groq uses the current entry and relevant memories to shape the next questions,
   reflections, and comparisons across time.
5. Every interpretation stays tied to the source moments behind it.

## Run it

Requirements: Node.js, a Groq API key, and Supermemory Local.

```bash
npm install
npx supermemory local --port 6767
npm run dev
```

Paste the Groq key when onboarding opens. It is validated before use, encrypted
with the operating system's secure storage, and shown only by its final two
characters afterward.

For a good demo, use a few short entries about the same situation on different
dates, then open Reflections and ask what changed. The app should show the arc
through source-backed memories rather than a generic summary.

## Data

Journal entries stay in the local Electron app. Supermemory provides searchable
memory continuity, and Groq provides the language layer that makes that
continuity useful.

## Installers

Download the latest installers from the [Afterthought GitHub Release](https://github.com/haydenfd/afterthought/releases/tag/v0.1.2):

- macOS: `.dmg` for Apple Silicon (`arm64`) or Intel (`x64`)
- Windows: `.exe`
- Linux: `.AppImage` or `.deb`

macOS builds are currently unsigned. If macOS blocks the first launch, allow
Afterthought in System Settings > Privacy & Security.

To publish a new release, update the version in `package.json`, then push a
matching tag:

```bash
git tag v0.1.2
git push origin v0.1.2
```

GitHub Actions builds the platform installers and attaches them to the release.

## License

Afterthought is released under the [MIT License](LICENSE).
