export type ViewedState = 'viewed' | 'unviewed' | 'unknown';

export interface FileRecord {
  /** Full path inside the PR (stable identifier), e.g. `src/Services/CustomerService.cs`. */
  path: string;
  name: string;
  /** Parent directory, `''` for files at the repository root. */
  directory: string;
  /** Lower-case extension without the dot, `null` for `Makefile` / `.gitignore`. */
  extension: string | null;
  viewedState: ViewedState;
  /**
   * A supported, currently reachable native control exists for this file.
   * Being listed in the file tree is not enough.
   */
  actionable: boolean;
}

export type ActionScope = 'selected' | 'filtered' | 'available';
export type ViewedAction = 'mark-viewed' | 'mark-unviewed';

export interface Filters {
  /** Case-insensitive substring of the full path. */
  query: string;
  /** Raw extension input, e.g. `.cs`, `cs, ts`. Empty means no filter. */
  extensions: string;
  /** Folder path, matched on whole segments from the PR root. */
  folder: string;
}

export const EMPTY_FILTERS: Filters = { query: '', extensions: '', folder: '' };

export function targetState(action: ViewedAction): ViewedState {
  return action === 'mark-viewed' ? 'viewed' : 'unviewed';
}
