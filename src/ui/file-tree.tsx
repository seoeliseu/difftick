import { planOperation } from '../domain/operations';
import { checkState, type Selection } from '../domain/selection';
import type { DirectoryNode, FileNode, TreeNode } from '../domain/tree';
import type { ViewedAction } from '../domain/types';
import type { ReviewController } from '../content/controller';
import { strings } from './strings';

interface TreeProps {
  nodes: TreeNode[];
  folders: Map<string, DirectoryNode>;
  selection: Selection;
  collapsed: ReadonlySet<string>;
  /** While filtering, every folder is shown open so matches are never hidden. */
  forceOpen: boolean;
  busy: boolean;
  controller: ReviewController;
}

const STATE_ICON = { viewed: '✓', unviewed: '○', unknown: '?' } as const;

function FileRow({
  node,
  selection,
  controller,
}: {
  node: FileNode;
  selection: Selection;
  controller: ReviewController;
}) {
  const { file } = node;
  const label = file.actionable ? strings.state[file.viewedState] : strings.notReachable;
  const status = file.actionable ? file.viewedState : 'unavailable';
  return (
    <li class="file">
      <label class="row" title={file.path}>
        <input
          type="checkbox"
          checked={selection.has(file.path)}
          aria-label={strings.fileSelect(file.path)}
          onChange={() => controller.toggleFile(file.path)}
        />
        <span class="name">{node.name}</span>
        <span class={`badge ${status}`}>
          <span aria-hidden="true">{file.actionable ? STATE_ICON[file.viewedState] : '–'}</span>{' '}
          {label}
        </span>
      </label>
    </li>
  );
}

function FolderRow({ node, props }: { node: DirectoryNode; props: TreeProps }) {
  const { folders, selection, collapsed, forceOpen, busy, controller } = props;
  // Checkbox state and quick actions always cover the whole folder, not just the filtered view.
  const all = folders.get(node.path)?.files ?? node.files;
  const state = checkState(selection, all);
  const expanded = forceOpen || !collapsed.has(node.path);
  const selectedCount = all.filter((file) => selection.has(file.path)).length;
  const can = (action: ViewedAction) => planOperation(action, all).eligible.length > 0;

  return (
    <li class="folder">
      <div class="row">
        <button
          type="button"
          class="twisty"
          aria-expanded={expanded}
          aria-label={strings.folderToggle(node.path, expanded)}
          disabled={forceOpen}
          onClick={() => controller.toggleFolderCollapsed(node.path)}
        >
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </button>
        <input
          type="checkbox"
          checked={state === 'checked'}
          ref={(element) => {
            if (element) element.indeterminate = state === 'indeterminate';
          }}
          aria-label={strings.folderSelect(node.path, all.length)}
          title={strings.folderSelect(node.path, all.length)}
          onChange={() => controller.toggleFolderSelection(node.path)}
        />
        <span class="name folder-name" title={node.path}>
          {node.name}/
        </span>
        <span class="count">
          {selectedCount}/{all.length}
        </span>
        <span class="quick">
          <button
            type="button"
            class="mini"
            aria-label={strings.folderMarkLabel(node.path)}
            title={strings.folderMarkLabel(node.path)}
            disabled={busy || !can('mark-viewed')}
            onClick={() => controller.requestFolderAction(node.path, 'mark-viewed')}
          >
            {strings.folderMark}
          </button>
          <button
            type="button"
            class="mini"
            aria-label={strings.folderUnmarkLabel(node.path)}
            title={strings.folderUnmarkLabel(node.path)}
            disabled={busy || !can('mark-unviewed')}
            onClick={() => controller.requestFolderAction(node.path, 'mark-unviewed')}
          >
            {strings.folderUnmark}
          </button>
        </span>
      </div>
      {expanded && <TreeList {...props} nodes={node.children} />}
    </li>
  );
}

export function TreeList(props: TreeProps) {
  return (
    <ul class="tree">
      {props.nodes.map((node) =>
        node.kind === 'directory' ? (
          <FolderRow key={`d:${node.path}`} node={node} props={props} />
        ) : (
          <FileRow
            key={`f:${node.path}`}
            node={node}
            selection={props.selection}
            controller={props.controller}
          />
        ),
      )}
    </ul>
  );
}
