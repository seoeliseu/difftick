import type { AdapterProfile } from './dom-adapter';
import { DomFilesAdapter, isViewedCheckbox, type DomAdapterTiming } from './dom-adapter';

/**
 * Classic "Files changed" layout (`div.file.js-file` per diff, `<file-tree>` sidebar).
 *
 * VERIFIED against live github.com markup (signed-out capture, see
 * src/test/fixtures/classic-captured-signed-out.html):
 *   - container      `div.file.js-file#diff-<hash>[data-tagsearch-path]`
 *   - header         `.file-header[data-path]`
 *   - tree entries   `li[role=treeitem][data-tree-entry-type=file]` containing
 *                    `[data-filterable-item-text]` with the full path
 *
 * UNVERIFIED (the Viewed control is only rendered for signed-in users, so it could not be
 * captured). These selectors come from GitHub's classic markup as remembered and MUST be
 * validated manually on a real PR while signed in. If none matches, files are reported as
 * known-but-not-actionable and nothing is ever written.
 */
export const CLASSIC_VIEWED_CONTROL_SELECTORS = [
  'input.js-reviewed-checkbox', // UNVERIFIED
  'form.js-toggle-user-reviewed-file-form input[type="checkbox"]', // UNVERIFIED
  '.js-reviewed-toggle input[type="checkbox"]', // UNVERIFIED
] as const;

export const classicProfile: AdapterProfile = {
  kind: 'classic',

  containers: (root) => [...root.querySelectorAll<HTMLElement>('div.file.js-file')],

  readPath(container) {
    const fromContainer = container.getAttribute('data-tagsearch-path');
    if (fromContainer) return fromContainer;
    return container.querySelector('.file-header[data-path]')?.getAttribute('data-path') ?? null;
  },

  findViewedControl(container) {
    // Scope to the header so task-list checkboxes inside rendered markdown are never matched.
    const scope = container.querySelector('.file-header') ?? container;
    for (const selector of CLASSIC_VIEWED_CONTROL_SELECTORS) {
      const match = scope.querySelector(selector);
      if (isViewedCheckbox(match)) return match;
    }
    return null;
  },

  treePaths(root) {
    const paths: string[] = [];
    for (const item of root.querySelectorAll('li[role="treeitem"][data-tree-entry-type="file"]')) {
      const text = item.querySelector('[data-filterable-item-text]')?.textContent?.trim();
      if (text) paths.push(text);
    }
    return paths;
  },
};

export function createClassicAdapter(
  root: Document | HTMLElement,
  timing?: Partial<DomAdapterTiming>,
): DomFilesAdapter {
  return new DomFilesAdapter(classicProfile, root, timing);
}
