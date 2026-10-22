import type { AdapterProfile } from './dom-adapter';
import { DomFilesAdapter, isViewedCheckbox, type DomAdapterTiming } from './dom-adapter';

/**
 * New "Files changed" experience (`/changes`, React, virtualised diff list).
 *
 * EVERYTHING HERE IS UNVERIFIED. The new layout could not be captured while building
 * this (the public preview was not served to a signed-out visitor), so these are
 * deliberately generic, defensive heuristics, exercised only against SYNTHETIC contract
 * fixtures (src/test/fixtures/changes-*.html), not live GitHub markup. They must be
 * validated manually on a real PR before this adapter is considered compatible.
 *
 * Failure mode is safe by construction: no recognisable container or control means the
 * file is unknown / not actionable, and DiffTick never writes.
 */
export const CHANGES_SELECTORS = {
  /** Diff anchors share the `diff-<hash>` id scheme of the classic layout. UNVERIFIED */
  container: '[id^="diff-"]',
  /** Attributes that may carry the file path, on the container or a descendant. UNVERIFIED */
  pathAttributes: ['data-file-path', 'data-tagsearch-path', 'data-path'],
  checkbox: 'input[type="checkbox"]',
} as const;

/** Structural hints first; visible text is only ever one signal among several. */
const VIEWED_HINT = /viewed/i;

function labelText(input: HTMLInputElement): string {
  const labelled = input.getAttribute('aria-labelledby');
  const referenced = labelled
    ? labelled
        .split(/\s+/)
        .map((id) => input.ownerDocument.getElementById(id)?.textContent ?? '')
        .join(' ')
    : '';
  const wrapping = input.closest('label')?.textContent ?? '';
  const forLabel = input.id
    ? ([...input.ownerDocument.querySelectorAll('label[for]')].find(
        (label) => label.getAttribute('for') === input.id,
      )?.textContent ?? '')
    : '';
  return `${input.getAttribute('aria-label') ?? ''} ${referenced} ${wrapping} ${forLabel}`;
}

export function looksLikeViewedControl(input: HTMLInputElement): boolean {
  const structural = [input.name, input.id, input.getAttribute('data-testid') ?? ''];
  return structural.some((value) => VIEWED_HINT.test(value)) || VIEWED_HINT.test(labelText(input));
}

export const changesProfile: AdapterProfile = {
  kind: 'changes',

  containers(root) {
    return [...root.querySelectorAll<HTMLElement>(CHANGES_SELECTORS.container)].filter(
      // Avoid matching nested ids (e.g. `diff-…-line` anchors inside a file).
      (element) => element.parentElement?.closest(CHANGES_SELECTORS.container) == null,
    );
  },

  readPath(container) {
    for (const attribute of CHANGES_SELECTORS.pathAttributes) {
      const own = container.getAttribute(attribute);
      if (own) return own;
      const nested = container.querySelector(`[${attribute}]`)?.getAttribute(attribute);
      if (nested) return nested;
    }
    return null;
  },

  findViewedControl(container) {
    const candidates = [...container.querySelectorAll(CHANGES_SELECTORS.checkbox)].filter(
      (element): element is HTMLInputElement =>
        isViewedCheckbox(element) && looksLikeViewedControl(element),
    );
    // Ambiguity is not worth the risk of toggling the wrong control.
    return candidates.length === 1 ? (candidates[0] ?? null) : null;
  },
};

export function createChangesAdapter(
  root: Document | HTMLElement,
  timing?: Partial<DomAdapterTiming>,
): DomFilesAdapter {
  return new DomFilesAdapter(changesProfile, root, timing);
}
