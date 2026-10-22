import { createFileRecord } from '../domain/path-utils';
import { ViewedOperationError, type FailureKind, type ViewedGateway } from '../domain/operations';
import type { FileRecord, ViewedState } from '../domain/types';

export function file(
  path: string,
  viewedState: ViewedState = 'unviewed',
  actionable = true,
): FileRecord {
  return createFileRecord(path, viewedState, actionable);
}

export function files(paths: string[], viewedState: ViewedState = 'unviewed'): FileRecord[] {
  return paths.map((path) => file(path, viewedState));
}

export interface FakeGatewayOptions {
  /** Paths whose setViewed throws, with the failure kind. */
  failures?: Record<string, FailureKind>;
  /** Paths whose click "succeeds" but the state silently reverts (GitHub rejected it). */
  reverting?: string[];
  /** Hook run before each setViewed call; used to cancel mid-run. */
  beforeSet?: (path: string) => void;
}

/** In-memory stand-in for a GitHub adapter. */
export class FakeGateway implements ViewedGateway {
  readonly states = new Map<string, ViewedState>();
  readonly calls: string[] = [];

  constructor(
    initial: Record<string, ViewedState>,
    private readonly options: FakeGatewayOptions = {},
  ) {
    for (const [path, state] of Object.entries(initial)) this.states.set(path, state);
  }

  getViewedState(path: string): ViewedState {
    return this.states.get(path) ?? 'unknown';
  }

  setViewed(path: string, viewed: boolean, signal?: AbortSignal): Promise<void> {
    this.calls.push(path);
    this.options.beforeSet?.(path);
    if (signal?.aborted) return Promise.reject(new ViewedOperationError('aborted', 'Aborted'));
    const failure = this.options.failures?.[path];
    if (failure) return Promise.reject(new ViewedOperationError(failure, `${failure} for ${path}`));
    if (this.options.reverting?.includes(path)) {
      return Promise.resolve();
    }
    this.states.set(path, viewed ? 'viewed' : 'unviewed');
    return Promise.resolve();
  }
}
