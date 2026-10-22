import { describe, expect, it } from 'vitest';
import { dedupeFiles, mergeCatalog } from '../../domain/catalog';
import { buildTree, type DirectoryNode, type TreeNode } from '../../domain/tree';
import { file, files } from '../helpers';

const names = (nodes: TreeNode[]) => nodes.map((node) => `${node.kind[0]}:${node.name}`);

describe('buildTree', () => {
  const tree = buildTree(
    files([
      'src/Services/CustomerService.cs',
      'src/Services/Nested/OrderService.cs',
      'src/Domain/Customer.cs',
      'README.md',
      'src/index.ts',
    ]),
  );

  it('sorts directories before files, alphabetically', () => {
    expect(names(tree)).toEqual(['d:src', 'f:README.md']);
    const src = tree[0] as DirectoryNode;
    expect(names(src.children)).toEqual(['d:Domain', 'd:Services', 'f:index.ts']);
  });

  it('exposes every descendant file, recursively, on each directory', () => {
    const src = tree[0] as DirectoryNode;
    expect(src.files.map((f) => f.path)).toEqual([
      'src/Domain/Customer.cs',
      'src/index.ts',
      'src/Services/CustomerService.cs',
      'src/Services/Nested/OrderService.cs',
    ]);
    const services = src.children.find((c) => c.path === 'src/Services') as DirectoryNode;
    expect(services.files).toHaveLength(2);
  });

  it('does not merge same-named directories under different parents', () => {
    const result = buildTree(files(['a/utils/x.ts', 'b/utils/x.ts']));
    const [a, b] = result as DirectoryNode[];
    expect(a?.children[0]?.path).toBe('a/utils');
    expect(b?.children[0]?.path).toBe('b/utils');
  });
});

describe('dedupeFiles', () => {
  it('counts a path observed twice (tree + diff) once', () => {
    const result = dedupeFiles([
      file('src/a.ts', 'unknown', false),
      file('src/a.ts', 'viewed', true),
      file('./src/a.ts', 'unknown', false),
    ]);
    expect(result).toEqual([file('src/a.ts', 'viewed', true)]);
  });

  it('keeps the actionable record even when listed first', () => {
    const result = dedupeFiles([file('a.ts', 'unviewed', true), file('a.ts', 'unknown', false)]);
    expect(result).toHaveLength(1);
    expect(result[0]?.actionable).toBe(true);
  });

  it('drops empty paths', () => {
    expect(dedupeFiles([file('')])).toEqual([]);
  });
});

describe('mergeCatalog', () => {
  it('keeps files that disappear from the DOM as known but unknown-state and not actionable', () => {
    const first = mergeCatalog(new Map(), [file('a.ts', 'viewed'), file('b.ts', 'unviewed')]);
    const second = mergeCatalog(first, [file('b.ts', 'viewed')]);

    expect(second.get('a.ts')).toMatchObject({ viewedState: 'unknown', actionable: false });
    expect(second.get('b.ts')).toMatchObject({ viewedState: 'viewed', actionable: true });
    expect(second.size).toBe(2);
  });

  it('restores a file when it is observed again', () => {
    const hidden = mergeCatalog(mergeCatalog(new Map(), [file('a.ts')]), []);
    const back = mergeCatalog(hidden, [file('a.ts', 'viewed')]);
    expect(back.get('a.ts')).toMatchObject({ viewedState: 'viewed', actionable: true });
  });
});
