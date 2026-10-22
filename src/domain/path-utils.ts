import type { FileRecord, ViewedState } from './types';

/** Normalises separators and strips leading `./`, `/` and trailing `/`. Case is preserved. */
export function normalizePath(raw: string): string {
  const unified = raw.trim().replaceAll('\\', '/');
  return unified
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/');
}

export function splitPath(path: string): string[] {
  return path === '' ? [] : path.split('/');
}

export function getName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Parent directory, `''` for root-level files. */
export function getDirectory(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

/**
 * Lower-case extension without the dot. Dotfiles (`.gitignore`) and names ending
 * in a dot have no extension; `foo.test.ts` has `ts`.
 */
export function getExtension(path: string): string | null {
  const name = getName(path);
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

/** `.CS`, `*.cs` and `cs` all become `cs`. */
export function normalizeExtension(raw: string): string {
  return raw
    .trim()
    .replace(/^\*?\.+/, '')
    .toLowerCase();
}

/** Splits user input such as `.cs, .ts tsx` into unique normalised extensions. */
export function parseExtensions(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map(normalizeExtension)
    .filter((part) => part !== '');
  return [...new Set(parts)];
}

/**
 * True when `path` is inside `folder` (any depth). Matches whole segments only:
 * `src/api` contains `src/api/x.ts` but not `src/api-v2/x.ts`.
 * The root folder `''` contains everything.
 */
export function isInFolder(path: string, folder: string, caseSensitive = true): boolean {
  if (folder === '') return true;
  const subject = caseSensitive ? path : path.toLowerCase();
  const prefix = caseSensitive ? folder : folder.toLowerCase();
  return subject.startsWith(`${prefix}/`);
}

export function createFileRecord(
  rawPath: string,
  viewedState: ViewedState = 'unknown',
  actionable = false,
): FileRecord {
  const path = normalizePath(rawPath);
  return {
    path,
    name: getName(path),
    directory: getDirectory(path),
    extension: getExtension(path),
    viewedState,
    actionable,
  };
}
