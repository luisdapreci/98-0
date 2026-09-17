import { readFileSync } from 'node:fs';

const migration: { paths: Record<string, string>; sourceRevisions: Record<string, string> } = JSON.parse(
  readFileSync(new URL('../../docs/research/path-migration.json', import.meta.url), 'utf8'));

function relocate(value: unknown): unknown {
  if (typeof value === 'string') return migration.paths[value] ?? migration.sourceRevisions[value] ?? value;
  if (Array.isArray(value)) return value.map(relocate);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [migration.paths[key] ?? key, relocate(entry)]));
  }
  return value;
}

export function parseResearchJson(text: string): ReturnType<typeof JSON.parse> {
  return relocate(JSON.parse(text));
}