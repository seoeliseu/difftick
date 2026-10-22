import { collectExtensions, filterFiles, type ExtensionCount } from '../domain/filter-files';
import { planOperation, resolveScope, type OperationPlan } from '../domain/operations';
import { buildTree, type DirectoryNode, type TreeNode } from '../domain/tree';
import type { FileRecord, ViewedAction } from '../domain/types';
import type { PanelState } from './controller';

/** Everything the panel renders, derived from state in one pure pass. */
export interface PanelView {
  files: FileRecord[];
  filtered: FileRecord[];
  /** Tree of the filtered files (what the user sees). */
  tree: TreeNode[];
  /** Folder path -> every known descendant, ignoring filters (folder checkboxes use this). */
  folders: Map<string, DirectoryNode>;
  extensions: ExtensionCount[];
  actionableCount: number;
  scopeFiles: FileRecord[];
  plans: Record<ViewedAction, OperationPlan>;
}

export function deriveView(state: PanelState): PanelView {
  const { files, filters, selection, scope } = state;
  const filtered = filterFiles(files, filters);

  const folders = new Map<string, DirectoryNode>();
  const index = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'directory') {
        folders.set(node.path, node);
        index(node.children);
      }
    }
  };
  index(buildTree(files));

  const scopeFiles = resolveScope(scope, files, selection, filters);
  return {
    files,
    filtered,
    tree: buildTree(filtered),
    folders,
    extensions: collectExtensions(files),
    actionableCount: files.filter((file) => file.actionable).length,
    scopeFiles,
    plans: {
      'mark-viewed': planOperation('mark-viewed', scopeFiles),
      'mark-unviewed': planOperation('mark-unviewed', scopeFiles),
    },
  };
}
