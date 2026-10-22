import { ViewedOperationError } from '../domain/operations';
import { dedupeFiles } from '../domain/catalog';
import { createFileRecord, normalizePath } from '../domain/path-utils';
import type { FileRecord, ViewedState } from '../domain/types';
import type { AdapterKind, GithubFilesAdapter } from './adapter';
import { sleep, waitUntil } from './dom-utils';

/**
 * Everything layout-specific. A profile answers three questions about GitHub's DOM:
 * where each file's diff lives, what its path is, and which checkbox is the native
 * `Viewed` control. The shared adapter does the rest.
 */
export interface AdapterProfile {
  kind: Exclude<AdapterKind, 'unsupported'>;
  /** One element per rendered file diff. */
  containers(root: ParentNode): HTMLElement[];
  readPath(container: HTMLElement): string | null;
  findViewedControl(container: HTMLElement): HTMLInputElement | null;
  /** Paths listed by the page's file tree; may include files whose diff is not rendered. */
  treePaths?(root: ParentNode): string[];
}

export interface DomAdapterTiming {
  /** How long to wait for the native control to reach the requested state. */
  timeoutMs: number;
  pollMs: number;
  /** After reaching the state, it must still hold after this long (catches reverts). */
  settleMs: number;
}

export const DEFAULT_TIMING: DomAdapterTiming = { timeoutMs: 4000, pollMs: 50, settleMs: 250 };

export function isViewedCheckbox(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === 'checkbox';
}

/** The checkbox's own state is the single source of truth; DiffTick never caches it. */
export function readControlState(control: HTMLInputElement): ViewedState {
  if (control.indeterminate) return 'unknown';
  return control.checked ? 'viewed' : 'unviewed';
}

export class DomFilesAdapter implements GithubFilesAdapter {
  readonly kind: AdapterKind;
  private readonly index = new Map<string, HTMLElement>();
  private readonly timing: DomAdapterTiming;

  constructor(
    private readonly profile: AdapterProfile,
    private readonly root: Document | HTMLElement,
    timing: Partial<DomAdapterTiming> = {},
  ) {
    this.kind = profile.kind;
    this.timing = { ...DEFAULT_TIMING, ...timing };
  }

  isSupported(): boolean {
    return this.profile
      .containers(this.root)
      .some((container) => this.profile.readPath(container) !== null);
  }

  listFiles(): FileRecord[] {
    this.rebuildIndex();
    const records: FileRecord[] = [];

    for (const path of this.profile.treePaths?.(this.root) ?? []) {
      records.push(createFileRecord(path));
    }
    for (const [path, container] of this.index) {
      const control = this.profile.findViewedControl(container);
      const state = control ? readControlState(control) : 'unknown';
      const actionable = control !== null && !control.disabled && state !== 'unknown';
      records.push(createFileRecord(path, state, actionable));
    }
    return dedupeFiles(records);
  }

  getViewedState(path: string): ViewedState {
    const control = this.controlFor(path);
    return control ? readControlState(control) : 'unknown';
  }

  async setViewed(path: string, viewed: boolean, signal?: AbortSignal): Promise<void> {
    const target: ViewedState = viewed ? 'viewed' : 'unviewed';
    const aborted = () => new ViewedOperationError('aborted', 'Operation cancelled');

    if (signal?.aborted) throw aborted();
    const control = this.controlFor(path);
    if (!control) {
      throw new ViewedOperationError('unavailable', `No native Viewed control found for ${path}`);
    }
    if (control.disabled) {
      throw new ViewedOperationError('unavailable', `The Viewed control for ${path} is disabled`);
    }
    if (readControlState(control) === target) return;

    // A real click on GitHub's own control, so GitHub's handlers persist the change.
    control.click();

    const outcome = await waitUntil(() => this.getViewedState(path) === target, {
      timeoutMs: this.timing.timeoutMs,
      pollMs: this.timing.pollMs,
      signal,
    });
    if (outcome === 'aborted') throw aborted();
    if (outcome === 'timeout') {
      throw new ViewedOperationError(
        'verification',
        `GitHub did not confirm "${target}" for ${path}`,
      );
    }

    await sleep(this.timing.settleMs, signal);
    if (signal?.aborted) throw aborted();
    if (this.getViewedState(path) !== target) {
      throw new ViewedOperationError(
        'verification',
        `The state of ${path} reverted after the click`,
      );
    }
  }

  dispose(): void {
    this.index.clear();
  }

  private controlFor(path: string): HTMLInputElement | null {
    let container = this.index.get(path);
    if (!container?.isConnected) {
      this.rebuildIndex();
      container = this.index.get(path);
    }
    return container ? this.profile.findViewedControl(container) : null;
  }

  private rebuildIndex(): void {
    this.index.clear();
    for (const container of this.profile.containers(this.root)) {
      const raw = this.profile.readPath(container);
      const path = raw === null ? '' : normalizePath(raw);
      if (path === '') continue;
      const known = this.index.get(path);
      // If a path is rendered twice, keep the copy that has a working control.
      if (
        !known ||
        (!this.profile.findViewedControl(known) && this.profile.findViewedControl(container))
      ) {
        this.index.set(path, container);
      }
    }
  }
}
