import { normalizePath } from './path-utils';
import type { FileRecord } from './types';

export type Catalog = ReadonlyMap<string, FileRecord>;

function mergeDuplicate(existing: FileRecord, incoming: FileRecord): FileRecord {
  // The record backed by a working native control wins; otherwise prefer a known state.
  if (incoming.actionable !== existing.actionable) {
    return incoming.actionable ? incoming : existing;
  }
  if (existing.viewedState === 'unknown' && incoming.viewedState !== 'unknown') return incoming;
  return existing;
}

/** Collapses observations of the same path (e.g. file tree + diff panel) into one entry. */
export function dedupeFiles(observed: readonly FileRecord[]): FileRecord[] {
  const byPath = new Map<string, FileRecord>();
  for (const file of observed) {
    const path = normalizePath(file.path);
    if (path === '') continue;
    const record = path === file.path ? file : { ...file, path };
    const existing = byPath.get(path);
    byPath.set(path, existing ? mergeDuplicate(existing, record) : record);
  }
  return [...byPath.values()];
}

/**
 * Folds a fresh DOM observation into the known catalog. Files seen earlier but not
 * observed now (e.g. a virtualised list scrolled them away) stay known, but their
 * state is unknown and they are not actionable until they are seen again.
 */
export function mergeCatalog(previous: Catalog, observed: readonly FileRecord[]): Catalog {
  const next = new Map<string, FileRecord>();
  const current = dedupeFiles(observed);
  const seen = new Set(current.map((file) => file.path));

  for (const [path, file] of previous) {
    if (!seen.has(path)) next.set(path, { ...file, viewedState: 'unknown', actionable: false });
  }
  for (const file of current) next.set(file.path, file);
  return next;
}
