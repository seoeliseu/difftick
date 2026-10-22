/**
 * Programmatic DOM fixtures. The classic builder mirrors the VERIFIED container/header/tree
 * structure captured from live GitHub; its Viewed form is the UNVERIFIED part. The changes
 * builder is a SYNTHETIC contract fixture, not a capture of live GitHub.
 */

export interface FixtureFile {
  path: string;
  /** `null` = no Viewed control rendered (signed out, lazy diff, virtualised away). */
  viewed: boolean | null;
  disabled?: boolean;
  /** Rendered markdown task-list checkbox inside the diff body; must never be matched. */
  taskListBox?: boolean;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

let counter = 0;
function anchor(path: string): string {
  counter += 1;
  return `diff-${path.length.toString(16).padStart(4, '0')}${counter.toString(16).padStart(60, '0')}`;
}

function classicViewedForm(file: FixtureFile): string {
  if (file.viewed === null) return '';
  return `<form class="js-toggle-user-reviewed-file-form">
    <label class="btn btn-sm js-reviewed-toggle">
      <input type="checkbox" name="viewed" class="js-reviewed-checkbox"${file.viewed ? ' checked' : ''}${file.disabled ? ' disabled' : ''}>
      Viewed
    </label>
  </form>`;
}

export function classicFile(file: FixtureFile): string {
  const id = anchor(file.path);
  const path = escapeHtml(file.path);
  return `<div id="${id}" class="file js-file js-details-container" data-file-type=".x" data-tagsearch-path="${path}">
    <div class="file-header js-file-header" data-path="${path}" data-anchor="${id}">
      <div class="file-info"><a href="#${id}">${path}</a></div>
      <div class="file-actions">${classicViewedForm(file)}</div>
    </div>
    <div class="js-file-content">${
      file.taskListBox
        ? '<input type="checkbox" class="task-list-item-checkbox" aria-label="Viewed todo">'
        : ''
    }</div>
  </div>`;
}

export function classicTree(paths: string[]): string {
  const items = paths
    .map(
      (path) => `<li role="treeitem" data-tree-entry-type="file">
        <span data-filterable-item-text hidden>${escapeHtml(path)}</span>
        <a href="#x">${escapeHtml(path.split('/').pop() ?? path)}</a>
      </li>`,
    )
    .join('');
  return `<file-tree><nav aria-label="File Tree Navigation"><ul role="tree">${items}</ul></nav></file-tree>`;
}

export function classicPage(files: FixtureFile[], treeOnly: string[] = []): string {
  return `${classicTree([...files.map((f) => f.path), ...treeOnly])}${files.map(classicFile).join('')}`;
}

/** SYNTHETIC: assumes `diff-` ids, a path attribute and a labelled Viewed checkbox. */
export function changesFile(file: FixtureFile): string {
  const id = anchor(file.path);
  const control =
    file.viewed === null
      ? ''
      : `<label><input type="checkbox"${file.viewed ? ' checked' : ''}${file.disabled ? ' disabled' : ''}><span>Viewed</span></label>`;
  return `<section id="${id}" data-file-path="${escapeHtml(file.path)}">
    <header><h3>${escapeHtml(file.path)}</h3>${control}</header>
    <div id="${id}-line-1">diff body</div>
  </section>`;
}

export function changesPage(files: FixtureFile[]): string {
  return `<div data-synthetic-changes-layout>${files.map(changesFile).join('')}</div>`;
}

/**
 * Makes Viewed checkboxes behave like a GitHub that rejects some requests: after the
 * browser toggles the checkbox, `revert(path)` decides whether the page flips it back.
 * Returns a function that removes the behaviour (listeners on `document.body` outlive tests).
 */
export function installGithubBehaviour(
  root: ParentNode,
  options: { revert: (path: string) => boolean; delayMs?: number },
): () => void {
  const onChange = (event: Event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const host = input.closest('[data-tagsearch-path], [data-file-path]');
    const path = host?.getAttribute('data-tagsearch-path') ?? host?.getAttribute('data-file-path');
    if (path && options.revert(path)) {
      setTimeout(() => {
        input.checked = !input.checked;
      }, options.delayMs ?? 10);
    }
  };
  root.addEventListener('change', onChange, true);
  return () => root.removeEventListener('change', onChange, true);
}
