import type { FileRecord } from './types';

/**
 * Selection is a plain set of file paths. It is transient DiffTick state and
 * never touches GitHub's `Viewed` flags. All helpers return a new set.
 */
export type Selection = ReadonlySet<string>;

export type CheckState = 'checked' | 'unchecked' | 'indeterminate';

export const EMPTY_SELECTION: Selection = new Set<string>();

export function selectFiles(selection: Selection, files: readonly FileRecord[]): Selection {
  const next = new Set(selection);
  for (const file of files) next.add(file.path);
  return next;
}

export function deselectFiles(selection: Selection, files: readonly FileRecord[]): Selection {
  const next = new Set(selection);
  for (const file of files) next.delete(file.path);
  return next;
}

export function toggleFile(selection: Selection, file: FileRecord): Selection {
  return selection.has(file.path)
    ? deselectFiles(selection, [file])
    : selectFiles(selection, [file]);
}

/** Adds the matches to the existing selection (union, no duplicates). */
export function selectAllMatching(
  selection: Selection,
  matching: readonly FileRecord[],
): Selection {
  return selectFiles(selection, matching);
}

/** Clears everything, including items currently hidden by filters. */
export function clearSelection(): Selection {
  return new Set<string>();
}

export function checkState(selection: Selection, files: readonly FileRecord[]): CheckState {
  if (files.length === 0) return 'unchecked';
  let selected = 0;
  for (const file of files) if (selection.has(file.path)) selected += 1;
  if (selected === 0) return 'unchecked';
  return selected === files.length ? 'checked' : 'indeterminate';
}

/**
 * Folder checkbox behaviour: anything but fully checked becomes fully checked;
 * a fully checked folder is deselected. `descendants` must be the recursive file list.
 */
export function toggleFolder(selection: Selection, descendants: readonly FileRecord[]): Selection {
  return checkState(selection, descendants) === 'checked'
    ? deselectFiles(selection, descendants)
    : selectFiles(selection, descendants);
}
