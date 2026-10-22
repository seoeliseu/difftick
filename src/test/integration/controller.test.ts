import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewController } from '../../content/controller';
import { isAllClear } from '../../domain/operations';
import { classicPage, installGithubBehaviour, type FixtureFile } from '../builders';

const timing = { timeoutMs: 150, pollMs: 2, settleMs: 5 };
let active: ReviewController | null = null;
let restore: (() => void) | null = null;

function setup(
  files: FixtureFile[],
  options: { treeOnly?: string[]; itemDelayMs?: number } = {},
): ReviewController {
  document.body.innerHTML = classicPage(files, options.treeOnly);
  const controller = new ReviewController({
    document,
    timing,
    itemDelayMs: options.itemDelayMs ?? 0,
    detectionGraceMs: 0,
  });
  controller.start();
  active = controller;
  return controller;
}

const f = (path: string, viewed: boolean | null = false): FixtureFile => ({ path, viewed });
const many = (count: number, dir = 'src', viewed = false) =>
  Array.from({ length: count }, (_, i) => f(`${dir}/file${String(i).padStart(3, '0')}.ts`, viewed));

/** Native checkbox state as GitHub's page currently shows it. */
function viewedPaths(): string[] {
  return [...document.querySelectorAll<HTMLElement>('.file.js-file')]
    .filter((file) => file.querySelector<HTMLInputElement>('.js-reviewed-checkbox')?.checked)
    .map((file) => file.getAttribute('data-tagsearch-path') ?? '')
    .sort();
}

function select(controller: ReviewController, ...paths: string[]) {
  for (const path of paths) controller.toggleFile(path);
}

async function settled(controller: ReviewController): Promise<void> {
  await vi.waitFor(() => expect(controller.store.getState().run).toBeNull());
}

afterEach(() => {
  restore?.();
  restore = null;
  active?.dispose();
  active = null;
  document.body.innerHTML = '';
});

describe('catalog', () => {
  it('lists known files, flags the unreachable ones and never writes on start', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    const controller = setup([f('a.ts'), f('b.ts', true)], { treeOnly: ['c.ts'] });
    const state = controller.store.getState();

    expect(state.phase).toBe('ready');
    expect(state.adapterKind).toBe('classic');
    expect(state.files.map((x) => [x.path, x.actionable])).toEqual([
      ['a.ts', true],
      ['b.ts', true],
      ['c.ts', false],
    ]);
    expect(click).not.toHaveBeenCalled();
    expect(viewedPaths()).toEqual(['b.ts']);
  });

  it('waits for late diffs (partial DOM) and only then becomes ready', () => {
    document.body.innerHTML = '<main>Loading…</main>';
    const controller = new ReviewController({ document, timing, detectionGraceMs: 60_000 });
    controller.start();
    active = controller;
    expect(controller.store.getState().phase).toBe('detecting');

    document.body.innerHTML = classicPage([f('a.ts')]);
    controller.refresh();
    expect(controller.store.getState()).toMatchObject({
      phase: 'ready',
      files: [{ path: 'a.ts' }],
    });
  });

  it('declares an unrecognised layout unsupported after the grace period and cannot write', () => {
    document.body.innerHTML = '<main>Something else</main>';
    const controller = new ReviewController({ document, detectionGraceMs: 0 });
    controller.start();
    active = controller;
    expect(controller.store.getState().phase).toBe('unsupported');

    controller.setScope('available');
    controller.requestScopeAction('mark-viewed');
    expect(controller.store.getState()).toMatchObject({ run: null, confirm: null });
  });

  it('keeps files that scroll out of the DOM known but not actionable', () => {
    const controller = setup([f('a.ts'), f('b.ts')]);
    document.body.innerHTML = classicPage([f('b.ts')]);
    controller.refresh();
    const byPath = Object.fromEntries(controller.store.getState().files.map((x) => [x.path, x]));
    expect(byPath['a.ts']).toMatchObject({ actionable: false, viewedState: 'unknown' });
    expect(byPath['b.ts']).toMatchObject({ actionable: true });
  });
});

describe('selection and filters', () => {
  it('keeps the selection across filter changes and clears it globally (RF-04 acceptance)', () => {
    const controller = setup([f('a.cs'), f('b.cs'), f('c.cs'), f('d.json'), f('e.json')]);

    controller.setFilters({ extensions: '.cs' });
    select(controller, 'a.cs', 'b.cs', 'c.cs');
    controller.setFilters({ extensions: 'json' });
    select(controller, 'd.json', 'e.json');
    controller.resetFilters();

    expect(controller.store.getState().selection.size).toBe(5);
    expect(viewedPaths()).toEqual([]);

    controller.setFilters({ extensions: 'json' });
    controller.clearSelection();
    expect(controller.store.getState().selection.size).toBe(0);
  });

  it('selects all matching without dropping the existing selection', () => {
    const controller = setup([f('src/a.ts'), f('src/b.ts'), f('docs/c.md')]);
    select(controller, 'docs/c.md');
    controller.setFilters({ folder: 'src' });
    controller.selectAllMatching();
    expect([...controller.store.getState().selection].sort()).toEqual([
      'docs/c.md',
      'src/a.ts',
      'src/b.ts',
    ]);
  });

  it('selects folders recursively, excluding look-alike prefixes', () => {
    const controller = setup([
      f('src/Services/A.cs'),
      f('src/Services/Nested/X.cs'),
      f('src/ServicesV2/Y.cs'),
    ]);
    controller.toggleFolderSelection('src/Services');
    expect([...controller.store.getState().selection].sort()).toEqual([
      'src/Services/A.cs',
      'src/Services/Nested/X.cs',
    ]);
    controller.toggleFolderSelection('src/Services');
    expect(controller.store.getState().selection.size).toBe(0);
  });
});

describe('batch operations', () => {
  it('marks only the selected files and verifies them on the page', async () => {
    const controller = setup([f('a.ts'), f('b.ts'), f('c.ts'), f('d.ts', true)]);
    select(controller, 'a.ts', 'b.ts', 'd.ts');

    controller.requestScopeAction('mark-viewed');
    await settled(controller);

    expect(viewedPaths()).toEqual(['a.ts', 'b.ts', 'd.ts']);
    const { result } = controller.store.getState();
    expect(result).toMatchObject({
      status: 'completed',
      succeeded: ['a.ts', 'b.ts'],
      skipped: ['d.ts'],
    });
    expect(isAllClear(result!)).toBe(true);
  });

  it('marks as unviewed with the Filtered scope', async () => {
    const controller = setup([f('src/a.ts', true), f('src/b.ts', true), f('docs/c.md', true)]);
    controller.setFilters({ folder: 'src' });
    controller.setScope('filtered');

    controller.requestScopeAction('mark-unviewed');
    await settled(controller);

    expect(viewedPaths()).toEqual(['docs/c.md']);
  });

  it('runs without confirmation up to the threshold and asks above it', async () => {
    const small = setup(many(25));
    small.setScope('filtered');
    small.requestScopeAction('mark-viewed');
    expect(small.store.getState().confirm).toBeNull();
    await settled(small);
    expect(viewedPaths()).toHaveLength(25);
    small.dispose();

    const large = setup(many(26));
    large.setScope('filtered');
    large.requestScopeAction('mark-viewed');
    expect(large.store.getState().confirm).toMatchObject({ why: 'large', eligible: 26 });
    expect(viewedPaths()).toEqual([]);

    large.cancelConfirm();
    expect(viewedPaths()).toEqual([]);

    large.requestScopeAction('mark-viewed');
    large.confirm();
    await settled(large);
    expect(viewedPaths()).toHaveLength(26);
  });

  it('always confirms the Available scope, and says it is not the whole PR', () => {
    const controller = setup([f('a.ts'), f('b.ts')]);
    controller.setScope('available');
    controller.requestScopeAction('mark-viewed');
    expect(controller.store.getState().confirm).toMatchObject({
      why: 'available',
      label: 'Available files',
    });
    expect(viewedPaths()).toEqual([]);
  });

  it('never reports unreachable files as done (known 10, actionable 6)', async () => {
    const controller = setup(many(6), {
      treeOnly: ['src/hidden0.ts', 'src/hidden1.ts', 'src/hidden2.ts', 'src/hidden3.ts'],
    });
    controller.setScope('available');
    controller.requestScopeAction('mark-viewed');
    expect(controller.store.getState().confirm).toMatchObject({
      requested: 10,
      eligible: 6,
      unavailable: 4,
    });

    controller.confirm();
    await settled(controller);

    const { result } = controller.store.getState();
    expect(result?.succeeded).toHaveLength(6);
    expect(result?.unavailable).toHaveLength(4);
    expect(isAllClear(result!)).toBe(false);
  });

  it('folder action covers the subtree only and warns about unreachable descendants', async () => {
    const controller = setup(
      [f('src/Domain/A.cs'), f('src/Domain/Deep/B.cs'), f('src/Infrastructure/C.cs')],
      { treeOnly: ['src/Domain/Lazy.cs'] },
    );

    controller.requestFolderAction('src/Domain', 'mark-viewed');
    expect(controller.store.getState().confirm).toMatchObject({
      why: 'folder',
      requested: 3,
      eligible: 2,
      unavailable: 1,
    });
    controller.confirm();
    await settled(controller);

    expect(viewedPaths()).toEqual(['src/Domain/A.cs', 'src/Domain/Deep/B.cs']);
    expect(controller.store.getState().result?.unavailable.map((u) => u.path)).toEqual([
      'src/Domain/Lazy.cs',
    ]);
  });

  it('re-asks when more files would change than the user was shown', () => {
    const controller = setup(many(30));
    controller.setScope('filtered');
    controller.requestScopeAction('mark-viewed');
    expect(controller.store.getState().confirm?.eligible).toBe(30);

    document.body.innerHTML = classicPage(many(40));
    controller.confirm();

    expect(viewedPaths()).toEqual([]);
    expect(controller.store.getState()).toMatchObject({ run: null, confirm: { eligible: 40 } });
  });

  it('reports a partial failure separately and retries only the failures', async () => {
    const controller = setup([f('a.ts'), f('b.ts'), f('c.ts')]);
    restore = installGithubBehaviour(document.body, {
      revert: (path) => path === 'b.ts',
      delayMs: 2,
    });
    controller.setScope('filtered');

    controller.requestScopeAction('mark-viewed');
    await settled(controller);

    let { result } = controller.store.getState();
    expect(result?.succeeded).toEqual(['a.ts', 'c.ts']);
    expect(result?.failed.map((x) => x.path)).toEqual(['b.ts']);
    expect(viewedPaths()).toEqual(['a.ts', 'c.ts']);

    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    controller.retryFailed();
    await settled(controller);
    ({ result } = controller.store.getState());
    expect(click).toHaveBeenCalledTimes(1);
    expect(result?.failed.map((x) => x.path)).toEqual(['b.ts']);
  });

  it('cancel stops new work, keeps what was done and does not roll back', async () => {
    const controller = setup(many(10), { itemDelayMs: 15 });
    controller.setScope('filtered');

    const unsubscribe = controller.store.subscribe(() => {
      if ((controller.store.getState().run?.progress.succeeded ?? 0) >= 2) controller.cancelRun();
    }); // cancelRun is idempotent, so being called on every later update is fine
    controller.requestScopeAction('mark-viewed');
    await settled(controller);
    unsubscribe();

    const { result } = controller.store.getState();
    expect(result?.status).toBe('cancelled');
    expect(result?.pending.length).toBeGreaterThan(0);
    expect(result?.succeeded.length).toBeGreaterThanOrEqual(2);
    expect(viewedPaths()).toHaveLength(result?.succeeded.length ?? -1);
  });

  it('a route change (dispose) mid-run stops further clicks', async () => {
    const controller = setup(many(10), { itemDelayMs: 15 });
    controller.setScope('filtered');
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');

    controller.requestScopeAction('mark-viewed');
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    controller.dispose();
    const clicksAtDispose = click.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(click.mock.calls.length).toBeLessThanOrEqual(clicksAtDispose + 1);
    expect(viewedPaths().length).toBeLessThan(10);
  });

  it('refuses to start a second queue while one is running', async () => {
    const controller = setup(many(6), { itemDelayMs: 15 });
    controller.setScope('filtered');
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');

    controller.requestScopeAction('mark-viewed');
    controller.requestScopeAction('mark-unviewed');
    controller.requestFolderAction('src', 'mark-unviewed');
    await settled(controller);

    expect(click).toHaveBeenCalledTimes(6);
    expect(viewedPaths()).toHaveLength(6);
  });

  it('does nothing when the scope is empty', () => {
    const controller = setup([f('a.ts')]);
    controller.requestScopeAction('mark-viewed'); // nothing selected
    expect(controller.store.getState()).toMatchObject({ run: null, confirm: null, result: null });
  });
});
