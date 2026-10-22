export interface Debounced {
  (): void;
  cancel(): void;
}

/** Trailing debounce with a max wait, so a constantly mutating page still gets periodic updates. */
export function debounce(fn: () => void, waitMs: number, maxWaitMs = waitMs * 5): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = 0;

  const run = () => {
    timer = undefined;
    first = 0;
    fn();
  };
  const debounced = (() => {
    const now = Date.now();
    if (first === 0) first = now;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, Math.max(0, Math.min(waitMs, first + maxWaitMs - now)));
  }) as Debounced;
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    first = 0;
  };
  return debounced;
}

export interface DomWatcher {
  stop(): void;
}

/**
 * Debounced "something may have changed" signal: DOM mutations (structure and the
 * attributes that carry checkbox state) plus native `change` events, which do not
 * mutate attributes when a checkbox is toggled.
 */
export function watchDom(root: Document, onChange: () => void, waitMs = 200): DomWatcher {
  const notify = debounce(onChange, waitMs);
  const observer = new MutationObserver(notify);
  const target = root.body;
  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['checked', 'aria-checked', 'disabled', 'hidden'],
  });
  root.addEventListener('change', notify, true);

  return {
    stop() {
      observer.disconnect();
      root.removeEventListener('change', notify, true);
      notify.cancel();
    },
  };
}

export interface WaitOptions {
  timeoutMs: number;
  pollMs: number;
  signal?: AbortSignal | undefined;
}

export type WaitOutcome = 'met' | 'timeout' | 'aborted';

/** Polls `predicate` until true, the timeout elapses, or the signal aborts. */
export function waitUntil(predicate: () => boolean, options: WaitOptions): Promise<WaitOutcome> {
  const { timeoutMs, pollMs, signal } = options;
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve('aborted');
    if (predicate()) return resolve('met');

    const started = Date.now();
    const finish = (outcome: WaitOutcome) => {
      clearInterval(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(outcome);
    };
    const onAbort = () => finish('aborted');
    const timer = setInterval(() => {
      if (predicate()) finish('met');
      else if (Date.now() - started >= timeoutMs) finish('timeout');
    }, pollMs);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}
