import { describe, expect, it } from 'vitest';
import { filterFiles } from '../../domain/filter-files';
import {
  checkState,
  clearSelection,
  deselectFiles,
  EMPTY_SELECTION,
  selectAllMatching,
  selectFiles,
  toggleFile,
  toggleFolder,
} from '../../domain/selection';
import { buildTree, filesInFolder, type DirectoryNode } from '../../domain/tree';
import { EMPTY_FILTERS } from '../../domain/types';
import { files } from '../helpers';

const catalog = files([
  'src/Modules/A.cs',
  'src/Modules/B/More/C.cs',
  'src/ModulesExtra/D.cs',
  'a/utils/x.ts',
  'b/utils/x.ts',
  'data/1.json',
  'data/2.json',
]);

describe('selection', () => {
  it('is independent from filters and persists across them (RF-04 acceptance)', () => {
    const cs = files(['a.cs', 'b.cs', 'c.cs']);
    const json = files(['d.json', 'e.json']);
    const all = [...cs, ...json];

    let selection = selectAllMatching(
      EMPTY_SELECTION,
      filterFiles(all, { ...EMPTY_FILTERS, extensions: 'cs' }),
    );
    selection = selectAllMatching(
      selection,
      filterFiles(all, { ...EMPTY_FILTERS, extensions: 'json' }),
    );

    expect([...selection].sort()).toEqual(['a.cs', 'b.cs', 'c.cs', 'd.json', 'e.json']);
  });

  it('select all matching is a union without duplicates and does not mutate its input', () => {
    const first = selectFiles(EMPTY_SELECTION, files(['a.ts']));
    const second = selectAllMatching(first, files(['a.ts', 'b.ts']));
    expect([...first]).toEqual(['a.ts']);
    expect([...second]).toEqual(['a.ts', 'b.ts']);
  });

  it('clear selection removes everything, including entries hidden by a filter', () => {
    const hidden = selectFiles(EMPTY_SELECTION, catalog);
    expect(clearSelection().size).toBe(0);
    expect(hidden.size).toBe(catalog.length);
  });

  it('toggles a single file', () => {
    const [first] = catalog;
    if (!first) throw new Error('fixture empty');
    const on = toggleFile(EMPTY_SELECTION, first);
    expect(on.has(first.path)).toBe(true);
    expect(toggleFile(on, first).has(first.path)).toBe(false);
  });
});

describe('recursive folder selection', () => {
  const folder = (path: string) => filesInFolder(catalog, path);

  it('includes every descendant and excludes look-alike prefixes (RF-05 acceptance)', () => {
    const selection = toggleFolder(EMPTY_SELECTION, folder('src/Modules'));
    expect([...selection].sort()).toEqual(['src/Modules/A.cs', 'src/Modules/B/More/C.cs']);
    expect(selection.has('src/ModulesExtra/D.cs')).toBe(false);
  });

  it('keeps same-named folders at different levels apart', () => {
    const selection = toggleFolder(EMPTY_SELECTION, folder('a/utils'));
    expect([...selection]).toEqual(['a/utils/x.ts']);
  });

  it('reports tri-state: unchecked, indeterminate, checked', () => {
    const modules = folder('src/Modules');
    expect(checkState(EMPTY_SELECTION, modules)).toBe('unchecked');

    const partial = selectFiles(EMPTY_SELECTION, modules.slice(0, 1));
    expect(checkState(partial, modules)).toBe('indeterminate');

    const full = selectFiles(EMPTY_SELECTION, modules);
    expect(checkState(full, modules)).toBe('checked');
  });

  it('completes an indeterminate folder, then unchecks it on the next toggle', () => {
    const modules = folder('src/Modules');
    const partial = selectFiles(EMPTY_SELECTION, modules.slice(0, 1));
    const completed = toggleFolder(partial, modules);
    expect(checkState(completed, modules)).toBe('checked');
    expect(checkState(toggleFolder(completed, modules), modules)).toBe('unchecked');
  });

  it('only touches the folder subtree when unchecking', () => {
    const all = selectFiles(EMPTY_SELECTION, catalog);
    const after = toggleFolder(all, folder('src/Modules'));
    expect(after.has('src/ModulesExtra/D.cs')).toBe(true);
    expect(after.has('src/Modules/A.cs')).toBe(false);
  });

  it('shows parent folders as indeterminate when only a nested folder is selected', () => {
    const [src] = buildTree(catalog).filter((node): node is DirectoryNode => node.path === 'src');
    if (!src) throw new Error('src missing');
    const selection = selectFiles(EMPTY_SELECTION, folder('src/Modules/B'));
    expect(checkState(selection, src.files)).toBe('indeterminate');
  });

  it('treats an empty folder as unchecked and deselect is a no-op for unknown files', () => {
    expect(checkState(EMPTY_SELECTION, [])).toBe('unchecked');
    expect(deselectFiles(EMPTY_SELECTION, catalog).size).toBe(0);
  });
});
