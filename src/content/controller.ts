import { mergeCatalog, type Catalog } from '../domain/catalog';
import { clearFilters } from '../domain/filter-files';
import {
  planOperation,
  resolveScope,
  runOperation,
  type OperationProgress,
  type OperationResult,
} from '../domain/operations';
import {
  clearSelection,
  EMPTY_SELECTION,
  selectAllMatching,
  toggleFile,
  toggleFolder,
  type Selection,
} from '../domain/selection';
import { filesInFolder } from '../domain/tree';
import {
  EMPTY_FILTERS,
  type ActionScope,
  type FileRecord,
  type Filters,
  type ViewedAction,
} from '../domain/types';
import type { AdapterKind, GithubFilesAdapter } from '../github/adapter';
import { detectAdapter, isSignedIn } from '../github/detect-adapter';
import type { DomAdapterTiming } from '../github/dom-adapter';
import { watchDom, type DomWatcher } from '../github/dom-utils';
import { Store } from './store';

/** Operations above this many changes ask for confirmation. */
export const CONFIRM_THRESHOLD = 25;
/** Keep reporting "detecting" for this long before declaring the layout unsupported. */
const DETECTION_GRACE_MS = 8000;
/** Pause between native clicks so the page stays responsive and GitHub is not hammered. */
const ITEM_DELAY_MS = 60;

export type OperationSource =
  | { kind: 'scope'; scope: ActionScope }
  | { kind: 'folder'; folder: string }
  | { kind: 'retry'; paths: string[] };

export interface ConfirmRequest {
  action: ViewedAction;
  source: OperationSource;
  /** Shown to the user, e.g. `Available files` or `src/Services/`. */
  label: string;
  requested: number;
  eligible: number;
  alreadyInState: number;
  unavailable: number;
  why: 'large' | 'available' | 'folder';
}

export interface RunState {
  action: ViewedAction;
  label: string;
  progress: OperationProgress;
  cancelling: boolean;
}

export interface PanelState {
  phase: 'detecting' | 'ready' | 'unsupported';
  adapterKind: AdapterKind;
  signedIn: boolean;
  open: boolean;
  files: FileRecord[];
  filters: Filters;
  selection: Selection;
  scope: ActionScope;
  collapsedFolders: ReadonlySet<string>;
  run: RunState | null;
  confirm: ConfirmRequest | null;
  result: (OperationResult & { label: string }) | null;
}

export interface ControllerOptions {
  document: Document;
  timing?: Partial<DomAdapterTiming>;
  /** Test seam; defaults to feature detection against the real page. */
  detect?: (doc: Document) => GithubFilesAdapter;
  itemDelayMs?: number;
  detectionGraceMs?: number;
}

function sameCatalog(a: readonly FileRecord[], b: readonly FileRecord[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((file, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      file.path === other.path &&
      file.viewedState === other.viewedState &&
      file.actionable === other.actionable
    );
  });
}

/**
 * Owns the lifetime of one PR file-review session: observes the page, keeps the file
 * catalog, selection and filters, and runs batch operations through the adapter.
 * Disposing it (route change) aborts any running operation before it can touch the page.
 */
export class ReviewController {
  readonly store = new Store<PanelState>({
    phase: 'detecting',
    adapterKind: 'unsupported',
    signedIn: false,
    open: false,
    files: [],
    filters: { ...EMPTY_FILTERS },
    selection: EMPTY_SELECTION,
    scope: 'selected',
    collapsedFolders: new Set<string>(),
    run: null,
    confirm: null,
    result: null,
  });

  private adapter: GithubFilesAdapter | null = null;
  private catalog: Catalog = new Map();
  private watcher: DomWatcher | null = null;
  private runAbort: AbortController | null = null;
  private startedAt = 0;
  private disposed = false;
  private foldersSeeded = false;

  constructor(private readonly options: ControllerOptions) {}

  start(): void {
    this.startedAt = Date.now();
    this.watcher = watchDom(this.options.document, () => this.refresh());
    this.refresh();
  }

  dispose(): void {
    this.disposed = true;
    this.runAbort?.abort();
    this.watcher?.stop();
    this.adapter?.dispose();
    this.adapter = null;
  }

  // ---- page observation -------------------------------------------------------------

  refresh(): void {
    if (this.disposed) return;
    const doc = this.options.document;

    let adapter = this.adapter;
    if (!adapter?.isSupported()) {
      adapter?.dispose();
      const detect =
        this.options.detect ?? ((d: Document) => detectAdapter(d, this.options.timing));
      adapter = detect(doc);
      this.adapter = adapter;
    }

    const supported = adapter.isSupported();
    this.catalog = mergeCatalog(this.catalog, supported ? adapter.listFiles() : []);
    const files = [...this.catalog.values()];

    const grace = this.options.detectionGraceMs ?? DETECTION_GRACE_MS;
    const phase = supported
      ? 'ready'
      : Date.now() - this.startedAt >= grace
        ? 'unsupported'
        : 'detecting';

    const previous = this.store.getState();
    const changed =
      phase !== previous.phase ||
      adapter.kind !== previous.adapterKind ||
      !sameCatalog(files, previous.files);
    const signedIn = isSignedIn(doc);
    if (!changed && signedIn === previous.signedIn) return;

    this.store.setState({
      phase,
      adapterKind: adapter.kind,
      signedIn,
      files: changed ? files : previous.files,
      collapsedFolders: this.seedFolders(files, previous.collapsedFolders),
    });
  }

  /** Large PRs start with sub-folders collapsed so the panel stays short. */
  private seedFolders(files: readonly FileRecord[], current: ReadonlySet<string>) {
    if (this.foldersSeeded || files.length === 0) return current;
    this.foldersSeeded = true;
    if (files.length <= 40) return current;
    const collapsed = new Set<string>();
    for (const file of files) {
      const segments = file.directory.split('/').filter(Boolean);
      for (let depth = 2; depth <= segments.length; depth += 1) {
        collapsed.add(segments.slice(0, depth).join('/'));
      }
    }
    return collapsed;
  }

  // ---- panel state ------------------------------------------------------------------

  setOpen(open: boolean): void {
    this.store.setState({ open });
  }

  setFilters(patch: Partial<Filters>): void {
    this.store.setState((s) => ({ filters: { ...s.filters, ...patch } }));
  }

  /** Clears filters only; selection and Viewed state are untouched. */
  resetFilters(): void {
    this.store.setState({ filters: clearFilters() });
  }

  setScope(scope: ActionScope): void {
    this.store.setState({ scope, confirm: null });
  }

  toggleFile(path: string): void {
    const file = this.catalog.get(path);
    if (file) this.store.setState((s) => ({ selection: toggleFile(s.selection, file) }));
  }

  toggleFolderSelection(folder: string): void {
    const descendants = filesInFolder([...this.catalog.values()], folder);
    this.store.setState((s) => ({ selection: toggleFolder(s.selection, descendants) }));
  }

  selectAllMatching(): void {
    const { files, filters, selection } = this.store.getState();
    const matching = resolveScope('filtered', files, selection, filters);
    this.store.setState({ selection: selectAllMatching(selection, matching) });
  }

  clearSelection(): void {
    this.store.setState({ selection: clearSelection() });
  }

  toggleFolderCollapsed(folder: string): void {
    this.store.setState((s) => {
      const next = new Set(s.collapsedFolders);
      if (!next.delete(folder)) next.add(folder);
      return { collapsedFolders: next };
    });
  }

  dismissResult(): void {
    this.store.setState({ result: null });
  }

  // ---- batch operations -------------------------------------------------------------

  /** Scope buttons: runs straight away unless the confirmation rules apply. */
  requestScopeAction(action: ViewedAction): void {
    const { scope } = this.store.getState();
    this.request(action, { kind: 'scope', scope }, SCOPE_LABEL[scope]);
  }

  requestFolderAction(folder: string, action: ViewedAction): void {
    this.request(action, { kind: 'folder', folder }, `${folder}/`);
  }

  retryFailed(): void {
    const { result } = this.store.getState();
    if (!result || result.failed.length === 0) return;
    this.request(
      result.action,
      { kind: 'retry', paths: result.failed.map((f) => f.path) },
      'Failed files',
    );
  }

  cancelConfirm(): void {
    this.store.setState({ confirm: null });
  }

  confirm(): void {
    const { confirm } = this.store.getState();
    if (!confirm) return;
    this.store.setState({ confirm: null });
    // Targets are recomputed now; if more would change than the user was shown, ask again.
    this.refresh();
    const targets = this.resolveTargets(confirm.source);
    const plan = planOperation(confirm.action, targets);
    if (plan.eligible.length > confirm.eligible) {
      this.store.setState({
        confirm: { ...confirm, requested: targets.length, eligible: plan.eligible.length },
      });
      return;
    }
    void this.execute(confirm.action, targets, confirm.label);
  }

  cancelRun(): void {
    if (!this.runAbort || this.store.getState().run?.cancelling) return;
    this.runAbort.abort();
    this.store.setState((s) => (s.run ? { run: { ...s.run, cancelling: true } } : {}));
  }

  private request(action: ViewedAction, source: OperationSource, label: string): void {
    if (this.store.getState().run) return;
    this.refresh();
    const targets = this.resolveTargets(source);
    const plan = planOperation(action, targets);
    if (plan.eligible.length === 0 && plan.requested.length === 0) return;

    const why =
      source.kind === 'folder'
        ? 'folder'
        : source.kind === 'scope' && source.scope === 'available'
          ? 'available'
          : plan.eligible.length > CONFIRM_THRESHOLD
            ? 'large'
            : null;

    if (why === null) {
      void this.execute(action, targets, label);
      return;
    }
    this.store.setState({
      result: null,
      confirm: {
        action,
        source,
        label,
        why,
        requested: plan.requested.length,
        eligible: plan.eligible.length,
        alreadyInState: plan.alreadyInState.length,
        unavailable: plan.unavailable.length,
      },
    });
  }

  private resolveTargets(source: OperationSource): FileRecord[] {
    const state = this.store.getState();
    switch (source.kind) {
      case 'scope':
        return resolveScope(source.scope, state.files, state.selection, state.filters);
      case 'folder':
        return filesInFolder(state.files, source.folder);
      case 'retry': {
        const wanted = new Set(source.paths);
        return state.files.filter((file) => wanted.has(file.path));
      }
    }
  }

  private async execute(action: ViewedAction, targets: FileRecord[], label: string): Promise<void> {
    const adapter = this.adapter;
    if (!adapter || this.store.getState().run || this.disposed) return;

    const plan = planOperation(action, targets);
    const abort = new AbortController();
    this.runAbort = abort;
    this.store.setState({
      result: null,
      run: {
        action,
        label,
        cancelling: false,
        progress: {
          processed: 0,
          eligible: plan.eligible.length,
          succeeded: 0,
          failed: 0,
          skipped: plan.alreadyInState.length,
          unavailable: plan.unavailable.length,
          current: null,
        },
      },
    });

    let result: OperationResult;
    try {
      result = await runOperation({
        plan,
        gateway: adapter,
        signal: abort.signal,
        delayMs: this.options.itemDelayMs ?? ITEM_DELAY_MS,
        onProgress: (progress) => {
          if (this.disposed) return;
          this.store.setState((s) => (s.run ? { run: { ...s.run, progress } } : {}));
        },
      });
    } finally {
      this.runAbort = null;
    }

    if (this.disposed) return;
    this.refresh();
    this.store.setState({ run: null, result: { ...result, label } });
  }
}

const SCOPE_LABEL: Record<ActionScope, string> = {
  selected: 'Selected files',
  filtered: 'Filtered files',
  available: 'Available files',
};
