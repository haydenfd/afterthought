export function formatTheme(theme: string): string {
  const trimmed = theme.trim();
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}
