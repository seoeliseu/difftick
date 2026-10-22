import { ViewedOperationError } from '../domain/operations';
import type { FileRecord, ViewedState } from '../domain/types';
import type { GithubFilesAdapter } from './adapter';
import { createChangesAdapter } from './changes-adapter';
import { createClassicAdapter } from './classic-adapter';
import type { DomAdapterTiming } from './dom-adapter';

/** Read-only stand-in used when the page is not (yet) recognised. It can never write. */
export class UnsupportedAdapter implements GithubFilesAdapter {
  readonly kind = 'unsupported' as const;

  isSupported(): boolean {
    return false;
  }

  listFiles(): FileRecord[] {
    return [];
  }

  getViewedState(): ViewedState {
    return 'unknown';
  }

  setViewed(): Promise<void> {
    return Promise.reject(
      new ViewedOperationError('fatal', 'This GitHub layout is not supported; nothing was changed'),
    );
  }

  dispose(): void {
    /* nothing to release */
  }
}

/**
 * Feature detection by structure, not by route: `/files` can serve either layout, and
 * diffs may render after the page loads, so callers re-run this as the DOM changes.
 */
export function detectAdapter(
  root: Document | HTMLElement,
  timing?: Partial<DomAdapterTiming>,
): GithubFilesAdapter {
  const candidates = [createClassicAdapter(root, timing), createChangesAdapter(root, timing)];
  for (const candidate of candidates) {
    if (candidate.isSupported()) return candidate;
  }
  return new UnsupportedAdapter();
}

/** Hint for diagnostics only; never used to gate behaviour. */
export function isSignedIn(doc: Document): boolean {
  const login = doc.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content;
  return login !== undefined && login.trim() !== '';
}
