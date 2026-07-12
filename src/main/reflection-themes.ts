const fallbackThemeSignals: Array<{ theme: string; terms: RegExp }> = [
  {
    theme: 'work',
    terms: /\b(work|job|career|team|manager|client|project|meeting)\b/i,
  },
  {
    theme: 'relationships',
    terms:
      /\b(friend|partner|relationship|family|parent|mother|father|sister|brother|lonely)\b/i,
  },
  { theme: 'sleep', terms: /\b(sleep|bed|bedtime|rest|tired|insomnia|wake|waking)\b/i },
  {
    theme: 'health',
    terms: /\b(health|exercise|workout|run|running|body|pain|doctor|energy)\b/i,
  },
  {
    theme: 'habits',
    terms:
      /\b(habit\w*|routine\w*|practice\w*|consisten\w*|again|every day|each day|cutoff)\b/i,
  },
  {
    theme: 'motivation',
    terms: /\b(motivat\w*|drive|momentum|procrastinat\w*|stuck|effort|discipline)\b/i,
  },
  {
    theme: 'confidence',
    terms: /\b(confiden\w*|self-doubt|capable|insecure|imposter|believe in myself)\b/i,
  },
  {
    theme: 'creativity',
    terms: /\b(creativ\w*|write|writing|draw\w*|music|build\w*|idea\w*)\b/i,
  },
  {
    theme: 'uncertainty',
    terms:
      /\b(uncertain\w*|unsure|confus\w*|unknown|decision\w*|decide|choice\w*|wonder\w*)\b/i,
  },
  {
    theme: 'identity',
    terms: /\b(identity|who i am|becoming|kind of person|myself|self-worth)\b/i,
  },
  {
    theme: 'learning',
    terms:
      /\b(learn\w*|study\w*|understand\w*|curious|curiosity|discover\w*|skill\w*|practice\w*)\b/i,
  },
];

const maximumThemes = 5;

/**
 * This is deliberately a small offline safety net, not the product taxonomy.
 * Model-inferred themes can remain flexible; these labels keep retrieval useful
 * when Groq is unavailable.
 */
export function inferFallbackThemes(text: string): string[] {
  return fallbackThemeSignals
    .filter(({ terms }) => terms.test(text))
    .map(({ theme }) => theme)
    .slice(0, maximumThemes);
}

export function normalizeThemes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const themes: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const theme = candidate
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9& -]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 36);
    if (theme && !themes.includes(theme)) {
      themes.push(theme);
    }
  }

  return themes.slice(0, maximumThemes);
}
