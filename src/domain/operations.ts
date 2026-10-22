import { filterFiles } from './filter-files';
import type { Selection } from './selection';
import {
  targetState,
  type ActionScope,
  type FileRecord,
  type Filters,
  type ViewedAction,
  type ViewedState,
} from './types';

/**
 * - `unavailable`: control missing/unreachable, or state could not be verified.
 * - `verification`: the click happened but the state did not end up as requested.
 * - `fatal`: stop the whole queue (auth, rate limit, blocked page, incompatible UI).
 * - `aborted`: the operation was cancelled while this item was in flight.
 */
export type FailureKind = 'unavailable' | 'verification' | 'fatal' | 'aborted' | 'unknown';

export class ViewedOperationError extends Error {
  readonly kind: FailureKind;

  constructor(kind: FailureKind, message: string) {
    super(message);
    this.name = 'ViewedOperationError';
    this.kind = kind;
  }
}

/** What the domain needs from a GitHub adapter. */
export interface ViewedGateway {
  getViewedState(path: string): ViewedState;
  /** Must resolve only after the native state was observed to match `viewed`. */
  setViewed(path: string, viewed: boolean, signal?: AbortSignal): Promise<void>;
}

export function resolveScope(
  scope: ActionScope,
  files: readonly FileRecord[],
  selection: Selection,
  filters: Filters,
): FileRecord[] {
  switch (scope) {
    case 'selected':
      return files.filter((file) => selection.has(file.path));
    case 'filtered':
      return filterFiles(files, filters);
    case 'available':
      return [...files];
  }
}

export interface UnavailableFile {
  path: string;
  reason: string;
}

export interface OperationPlan {
  action: ViewedAction;
  /** Everything the user asked for. */
  requested: FileRecord[];
  /** Actionable files whose state differs from the target. */
  eligible: FileRecord[];
  /** Already in the target state: nothing to do. */
  alreadyInState: FileRecord[];
  /** Cannot be processed right now; never reported as success. */
  unavailable: UnavailableFile[];
}

export function planOperation(
  action: ViewedAction,
  requested: readonly FileRecord[],
): OperationPlan {
  const target = targetState(action);
  const plan: OperationPlan = {
    action,
    requested: [...requested],
    eligible: [],
    alreadyInState: [],
    unavailable: [],
  };

  for (const file of requested) {
    if (!file.actionable) {
      plan.unavailable.push({ path: file.path, reason: 'No native Viewed control is reachable' });
    } else if (file.viewedState === 'unknown') {
      plan.unavailable.push({ path: file.path, reason: 'Current state could not be verified' });
    } else if (file.viewedState === target) {
      plan.alreadyInState.push(file);
    } else {
      plan.eligible.push(file);
    }
  }
  return plan;
}

export interface OperationProgress {
  processed: number;
  eligible: number;
  succeeded: number;
  failed: number;
  skipped: number;
  unavailable: number;
  current: string | null;
}

export type OperationStatus = 'completed' | 'cancelled' | 'stopped';

export interface OperationResult {
  action: ViewedAction;
  status: OperationStatus;
  /** Human-readable cause when `status` is `stopped`/`cancelled`. */
  reason: string | null;
  requested: number;
  succeeded: string[];
  failed: Array<{ path: string; message: string }>;
  /** Already in the target state, plus items that changed on their own before we got to them. */
  skipped: string[];
  unavailable: UnavailableFile[];
  /** Eligible items that were never attempted (cancelled or stopped early). */
  pending: string[];
}

export interface RunOptions {
  plan: OperationPlan;
  gateway: ViewedGateway;
  signal: AbortSignal;
  onProgress?: (progress: OperationProgress) => void;
  /** Queue stops after this many failures in a row. */
  maxConsecutiveFailures?: number;
  /** Pause between items so the page stays responsive and requests are not hammered. */
  delayMs?: number;
}

const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sequentially applies the plan through the native controls.
 * Never retries; stops on fatal errors or repeated failures; re-reads every
 * success at the end so the reported counts reflect observed state.
 */
export async function runOperation(options: RunOptions): Promise<OperationResult> {
  const { plan, gateway, signal, onProgress } = options;
  const maxConsecutiveFailures = options.maxConsecutiveFailures ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;
  const delayMs = options.delayMs ?? 0;
  const target = targetState(plan.action);
  const viewed = target === 'viewed';

  const result: OperationResult = {
    action: plan.action,
    status: 'completed',
    reason: null,
    requested: plan.requested.length,
    succeeded: [],
    failed: [],
    skipped: plan.alreadyInState.map((file) => file.path),
    unavailable: [...plan.unavailable],
    pending: [],
  };

  const eligible = plan.eligible.map((file) => file.path);
  let processed = 0;
  let consecutiveFailures = 0;

  const emit = (current: string | null) =>
    onProgress?.({
      processed,
      eligible: eligible.length,
      succeeded: result.succeeded.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
      unavailable: result.unavailable.length,
      current,
    });

  emit(null);

  let index = 0;
  for (; index < eligible.length; index += 1) {
    const path = eligible[index];
    if (path === undefined) continue;

    if (signal.aborted) {
      result.status = 'cancelled';
      result.reason = 'Cancelled';
      break;
    }
    emit(path);

    // Targets are re-evaluated at the moment of action, not when the panel was opened.
    const before = gateway.getViewedState(path);
    if (before === target) {
      result.skipped.push(path);
      processed += 1;
      emit(null);
      continue;
    }
    if (before === 'unknown') {
      result.unavailable.push({ path, reason: 'Native control is no longer reachable' });
      processed += 1;
      emit(null);
      continue;
    }

    let stop = false;
    let attempted = true;
    try {
      await gateway.setViewed(path, viewed, signal);
      result.succeeded.push(path);
      consecutiveFailures = 0;
    } catch (error) {
      const kind = error instanceof ViewedOperationError ? error.kind : 'unknown';
      if (kind === 'aborted') {
        // The click may have landed before the cancel; only report what we can observe.
        if (gateway.getViewedState(path) === target) {
          result.succeeded.push(path);
        } else {
          result.pending.push(path);
          attempted = false;
        }
        result.status = 'cancelled';
        result.reason = 'Cancelled';
        stop = true;
        index += 1;
      } else if (kind === 'unavailable') {
        result.unavailable.push({ path, reason: errorMessage(error) });
        consecutiveFailures = 0;
      } else {
        result.failed.push({ path, message: errorMessage(error) });
        consecutiveFailures += 1;
        if (kind === 'fatal') {
          result.status = 'stopped';
          result.reason = errorMessage(error);
          stop = true;
          index += 1;
        } else if (consecutiveFailures >= maxConsecutiveFailures) {
          result.status = 'stopped';
          result.reason = `Stopped after ${maxConsecutiveFailures} consecutive failures`;
          stop = true;
          index += 1;
        }
      }
    }

    if (attempted) processed += 1;
    if (stop) break;
    emit(null);
    await wait(delayMs, signal);
  }

  for (let rest = index; rest < eligible.length; rest += 1) {
    const path = eligible[rest];
    if (path !== undefined) result.pending.push(path);
  }

  // Final revalidation: only states we can still observe count as success.
  const verified: string[] = [];
  for (const path of result.succeeded) {
    const after = gateway.getViewedState(path);
    if (after === target) {
      verified.push(path);
    } else {
      result.failed.push({
        path,
        message:
          after === 'unknown'
            ? 'Could not re-verify the final state'
            : 'GitHub did not keep the new state',
      });
    }
  }
  result.succeeded = verified;
  emit(null);
  return result;
}

export function isAllClear(result: OperationResult): boolean {
  return (
    result.status === 'completed' &&
    result.failed.length === 0 &&
    result.unavailable.length === 0 &&
    result.pending.length === 0
  );
}
