import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewedOperationError } from '../../domain/operations';
import { createClassicAdapter } from '../../github/classic-adapter';
import { classicPage, installGithubBehaviour, type FixtureFile } from '../builders';
import capturedSignedOut from '../fixtures/classic-captured-signed-out.html?raw';

const timing = { timeoutMs: 120, pollMs: 5, settleMs: 20 };

function mount(html: string) {
  document.body.innerHTML = html;
  return createClassicAdapter(document, timing);
}

const f = (
  path: string,
  viewed: boolean | null,
  extra: Partial<FixtureFile> = {},
): FixtureFile => ({
  path,
  viewed,
  ...extra,
});

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('classic adapter — live markup captured signed out (verified selectors)', () => {
  it('lists each file once even though the tree and the diff both mention it', () => {
    const adapter = mount(capturedSignedOut);
    expect(adapter.isSupported()).toBe(true);

    const files = adapter.listFiles();
    expect(files.map((file) => file.path).sort()).toEqual([
      'docs/guide/api-environment-frameworks.md',
      'docs/guide/api-environment-instances.md',
      'docs/guide/api-environment.md',
    ]);
  });

  it('never claims a file is actionable when no Viewed control exists (signed out)', async () => {
    const adapter = mount(capturedSignedOut);
    expect(
      adapter.listFiles().every((file) => !file.actionable && file.viewedState === 'unknown'),
    ).toBe(true);

    const before = document.body.innerHTML;
    await expect(adapter.setViewed('docs/guide/api-environment.md', true)).rejects.toMatchObject({
      kind: 'unavailable',
    });
    expect(document.body.innerHTML).toBe(before);
  });
});

describe('classic adapter — Viewed controls (control selectors are UNVERIFIED)', () => {
  it('reads viewed / unviewed state and actionability from the native checkbox', () => {
    const adapter = mount(
      classicPage([f('src/a.cs', true), f('src/b.cs', false), f('src/c.cs', null, {})]),
    );
    const byPath = Object.fromEntries(adapter.listFiles().map((file) => [file.path, file]));

    expect(byPath['src/a.cs']).toMatchObject({ viewedState: 'viewed', actionable: true });
    expect(byPath['src/b.cs']).toMatchObject({ viewedState: 'unviewed', actionable: true });
    expect(byPath['src/c.cs']).toMatchObject({ viewedState: 'unknown', actionable: false });
  });

  it('handles root files, dotfiles, spaces and Unicode in paths', () => {
    const paths = [
      'README.md',
      '.github/workflows/ci.yml',
      'docs/Relatório Final.md',
      'src/日本語.ts',
    ];
    const adapter = mount(classicPage(paths.map((path) => f(path, false))));
    expect(
      adapter
        .listFiles()
        .map((file) => file.path)
        .sort(),
    ).toEqual([...paths].sort());
    expect(adapter.getViewedState('docs/Relatório Final.md')).toBe('unviewed');
  });

  it('keeps tree-only files as known but not actionable (virtualised diffs)', () => {
    const adapter = mount(classicPage([f('src/rendered.ts', false)], ['src/not-rendered.ts']));
    const files = adapter.listFiles();
    expect(files).toHaveLength(2);
    expect(files.find((file) => file.path === 'src/not-rendered.ts')).toMatchObject({
      viewedState: 'unknown',
      actionable: false,
    });
  });

  it('does not treat a task-list checkbox inside the diff as the Viewed control', () => {
    const adapter = mount(classicPage([f('README.md', null, { taskListBox: true })]));
    expect(adapter.listFiles()[0]).toMatchObject({ actionable: false, viewedState: 'unknown' });
  });

  it('treats a disabled control as not actionable', () => {
    const adapter = mount(classicPage([f('a.ts', false, { disabled: true })]));
    expect(adapter.listFiles()[0]?.actionable).toBe(false);
  });

  it('copes with partially loaded DOM: container without header, and nothing at all', () => {
    const adapter = mount('<div class="file js-file" data-tagsearch-path="src/lazy.ts"></div>');
    expect(adapter.listFiles()).toEqual([
      expect.objectContaining({ path: 'src/lazy.ts', actionable: false, viewedState: 'unknown' }),
    ]);

    const empty = mount('<div class="file js-file"></div><p>loading…</p>');
    expect(empty.isSupported()).toBe(false);
    expect(empty.listFiles()).toEqual([]);
  });

  it('prefers the rendering of a duplicated path that has a working control', () => {
    const adapter = mount(classicPage([f('a.ts', null), f('a.ts', false)]));
    const files = adapter.listFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ actionable: true, viewedState: 'unviewed' });
  });
});

describe('classic adapter — setViewed', () => {
  it('clicks the native control and resolves once the state is observed', async () => {
    const adapter = mount(classicPage([f('a.ts', false)]));
    await adapter.setViewed('a.ts', true);
    expect(adapter.getViewedState('a.ts')).toBe('viewed');
    await adapter.setViewed('a.ts', false);
    expect(adapter.getViewedState('a.ts')).toBe('unviewed');
  });

  it('does not click when the file is already in the target state', async () => {
    const adapter = mount(classicPage([f('a.ts', true)]));
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    await adapter.setViewed('a.ts', true);
    expect(click).not.toHaveBeenCalled();
  });

  it('only touches the requested file', async () => {
    const adapter = mount(classicPage([f('a.ts', false), f('b.ts', false)]));
    await adapter.setViewed('a.ts', true);
    expect(adapter.getViewedState('b.ts')).toBe('unviewed');
  });

  it('fails with verification when GitHub flips the checkbox back after the click', async () => {
    document.body.innerHTML = classicPage([f('a.ts', false)]);
    const restore = installGithubBehaviour(document.body, { revert: () => true, delayMs: 5 });
    const adapter = createClassicAdapter(document, timing);

    try {
      await expect(adapter.setViewed('a.ts', true)).rejects.toMatchObject({ kind: 'verification' });
      expect(adapter.getViewedState('a.ts')).toBe('unviewed');
    } finally {
      restore();
    }
  });

  it('reports unavailable for a disabled control and for an unknown path', async () => {
    const adapter = mount(classicPage([f('a.ts', false, { disabled: true })]));
    await expect(adapter.setViewed('a.ts', true)).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(adapter.setViewed('missing.ts', true)).rejects.toBeInstanceOf(
      ViewedOperationError,
    );
  });

  it('rejects with aborted without clicking when the signal is already aborted', async () => {
    const adapter = mount(classicPage([f('a.ts', false)]));
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.setViewed('a.ts', true, controller.signal)).rejects.toMatchObject({
      kind: 'aborted',
    });
    expect(adapter.getViewedState('a.ts')).toBe('unviewed');
  });

  it('rejects with aborted if cancelled while waiting for the state to settle', async () => {
    const adapter = mount(classicPage([f('a.ts', false)]));
    const controller = new AbortController();
    const pending = adapter.setViewed('a.ts', true, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('times out as a verification error when the control never changes state', async () => {
    const adapter = mount(classicPage([f('a.ts', false)]));
    // A control whose click is swallowed (e.g. GitHub blocked the action).
    document.querySelector('input.js-reviewed-checkbox')?.addEventListener('click', (event) => {
      event.preventDefault();
    });
    await expect(adapter.setViewed('a.ts', true)).rejects.toMatchObject({ kind: 'verification' });
  });

  it('finds the control again after GitHub re-renders the file container', async () => {
    const adapter = mount(classicPage([f('a.ts', false)]));
    expect(adapter.getViewedState('a.ts')).toBe('unviewed');
    document.body.innerHTML = classicPage([f('a.ts', false)]);
    await adapter.setViewed('a.ts', true);
    expect(adapter.getViewedState('a.ts')).toBe('viewed');
  });
});
