import { splitPath } from './path-utils';
import type { FileRecord } from './types';

export interface FileNode {
  kind: 'file';
  /** Full path, unique per node. */
  path: string;
  name: string;
  file: FileRecord;
}

export interface DirectoryNode {
  kind: 'directory';
  /** Full path of the directory, e.g. `src/Services`. */
  path: string;
  name: string;
  children: TreeNode[];
  /** Every file below this directory, at any depth, in tree order. */
  files: FileRecord[];
}

export type TreeNode = FileNode | DirectoryNode;

function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Builds a folder tree from file paths. Directories are keyed by their full path,
 * so `a/utils` and `b/utils` stay distinct. Returns the top-level nodes.
 */
export function buildTree(files: readonly FileRecord[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const directories = new Map<string, DirectoryNode>();

  for (const file of files) {
    const segments = splitPath(file.path);
    let siblings = roots;
    let current = '';
    for (const segment of segments.slice(0, -1)) {
      current = current === '' ? segment : `${current}/${segment}`;
      let directory = directories.get(current);
      if (!directory) {
        directory = { kind: 'directory', path: current, name: segment, children: [], files: [] };
        directories.set(current, directory);
        siblings.push(directory);
      }
      directory.files.push(file);
      siblings = directory.children;
    }
    siblings.push({ kind: 'file', path: file.path, name: file.name, file });
  }

  const sortRecursively = (nodes: TreeNode[]): void => {
    nodes.sort(compareNodes);
    for (const node of nodes) {
      if (node.kind === 'directory') {
        sortRecursively(node.children);
        node.files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
      }
    }
  };
  sortRecursively(roots);
  return roots;
}

/** Descendant files of the directory at `folderPath` (recursive), `[]` if unknown. */
export function filesInFolder(files: readonly FileRecord[], folderPath: string): FileRecord[] {
  const prefix = `${folderPath}/`;
  return files.filter((file) => file.path.startsWith(prefix));
}
