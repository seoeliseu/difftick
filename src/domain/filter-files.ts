import { isInFolder, normalizePath, parseExtensions } from './path-utils';
import { EMPTY_FILTERS, type FileRecord, type Filters } from './types';

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.query.trim() !== '' ||
    parseExtensions(filters.extensions).length > 0 ||
    normalizePath(filters.folder) !== ''
  );
}

export function clearFilters(): Filters {
  return { ...EMPTY_FILTERS };
}

/** Criteria combine with AND; an empty criterion matches everything. */
export function createMatcher(filters: Filters): (file: FileRecord) => boolean {
  const query = filters.query.trim().toLowerCase();
  const extensions = new Set(parseExtensions(filters.extensions));
  const folder = normalizePath(filters.folder);

  return (file) => {
    if (query !== '' && !file.path.toLowerCase().includes(query)) return false;
    if (extensions.size > 0 && (file.extension === null || !extensions.has(file.extension))) {
      return false;
    }
    if (folder !== '' && !isInFolder(file.path, folder, false)) return false;
    return true;
  };
}

export function filterFiles(files: readonly FileRecord[], filters: Filters): FileRecord[] {
  return files.filter(createMatcher(filters));
}

export interface ExtensionCount {
  extension: string;
  count: number;
}

/** Extensions present in `files`, most common first. */
export function collectExtensions(files: readonly FileRecord[]): ExtensionCount[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.extension === null) continue;
    counts.set(file.extension, (counts.get(file.extension) ?? 0) + 1);
  }
  return [...counts]
    .map(([extension, count]) => ({ extension, count }))
    .sort((a, b) => b.count - a.count || a.extension.localeCompare(b.extension));
}
