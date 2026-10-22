import type { FileRecord, ViewedState } from '../domain/types';

export type AdapterKind = 'classic' | 'changes' | 'unsupported';

/**
 * Everything DiffTick knows about GitHub's UI lives behind this contract.
 * Adapters read the page and drive GitHub's own `Viewed` controls; they never
 * call GitHub endpoints, read tokens, or keep their own copy of the viewed state.
 */
export interface GithubFilesAdapter {
  readonly kind: AdapterKind;
  isSupported(): boolean;
  /** Snapshot of every file currently observable, one record per path. */
  listFiles(): FileRecord[];
  getViewedState(path: string): ViewedState;
  /**
   * Clicks the native control and resolves only once the new state was observed
   * (and stayed put briefly). Rejects with a `ViewedOperationError` otherwise.
   */
  setViewed(path: string, viewed: boolean, signal?: AbortSignal): Promise<void>;
  dispose(): void;
}
