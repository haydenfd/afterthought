export function MemoryPipelineNote() {
  return (
    <section
      className="rounded-lg border border-border/80 bg-card/35 p-4"
      aria-label="How the memory loop works"
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        The reflection loop
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Your writing is saved locally first, then indexed as source memories in
        Supermemory Local. Groq uses the current and retrieved context to shape a few
        cautious threads for the next session. Generated prompts are never stored as
        memories unless you answer them in your own writing.
      </p>
    </section>
  );
}
