import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOST_ATTRIBUTE } from '../../ui/mount';
import { Lifecycle } from '../../content/lifecycle';
import { classicPage } from '../builders';

const hosts = () => document.querySelectorAll(`[${HOST_ATTRIBUTE}]`);
const go = (path: string) => history.pushState({}, '', path);
let lifecycle: Lifecycle | null = null;

function boot(path: string, files = ['a.ts', 'b.ts', 'c.ts']): Lifecycle {
  go(path);
  document.body.innerHTML = classicPage(files.map((file) => ({ path: file, viewed: false })));
  lifecycle = new Lifecycle();
  lifecycle.start();
  return lifecycle;
}

afterEach(() => {
  lifecycle?.stop();
  lifecycle = null;
  document.body.innerHTML = '';
  go('/octo/repo/pull/1/files');
});

describe('Lifecycle', () => {
  it.each(['/octo/repo/pull/7/files', '/octo/repo/pull/7/changes', '/octo/repo/pull/7/files?w=1'])(
    'mounts exactly one panel on %s',
    (path) => {
      const current = boot(path);
      current.sync();
      current.sync();
      expect(hosts()).toHaveLength(1);
    },
  );

  it.each([
    '/',
    '/octo/repo',
    '/octo/repo/pull/7',
    '/octo/repo/pull/7/commits',
    '/octo/repo/issues/7',
  ])('does not mount on %s', (path) => {
    boot(path);
    expect(hosts()).toHaveLength(0);
  });

  it('unmounts when navigating away and remounts on another PR', () => {
    const current = boot('/octo/repo/pull/7/files');
    const first = hosts()[0];

    go('/octo/repo/pull/7/commits');
    current.sync();
    expect(hosts()).toHaveLength(0);

    go('/octo/repo/pull/8/files');
    current.sync();
    expect(hosts()).toHaveLength(1);
    expect(hosts()[0]).not.toBe(first);
  });

  it('keeps one panel when switching between /files and /changes of the same PR', () => {
    const current = boot('/octo/repo/pull/7/files');
    const first = hosts()[0];
    go('/octo/repo/pull/7/changes');
    current.sync();
    expect(hosts()).toHaveLength(1);
    expect(hosts()[0]).toBe(first);
  });

  it('builds a fresh panel (and drops the selection) when the PR changes', () => {
    const current = boot('/octo/repo/pull/7/files');
    const first = hosts()[0];
    go('/octo/repo/pull/9/files');
    current.sync();
    expect(hosts()[0]).not.toBe(first);
    expect(hosts()[0]?.isConnected).toBe(true);
    expect(first?.isConnected).toBe(false);
  });

  it('re-attaches the panel when the page replaces <body>', () => {
    const current = boot('/octo/repo/pull/7/files');
    const host = hosts()[0];
    host?.remove();
    expect(hosts()).toHaveLength(0);
    current.sync();
    expect(hosts()).toHaveLength(1);
    expect(hosts()[0]).toBe(host);
  });

  it('a newer instance takes over and the old one stops, leaving a single panel', () => {
    const older = boot('/octo/repo/pull/7/files');
    const newer = new Lifecycle();
    newer.start();
    older.sync();
    expect(hosts()).toHaveLength(1);
    newer.stop();
    expect(hosts()).toHaveLength(0);
  });

  it('removes its listeners and timer on stop()', () => {
    vi.useFakeTimers();
    try {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const current = boot('/octo/repo/pull/7/files');
      current.stop();
      expect(removeSpy).toHaveBeenCalled();
      expect(hosts()).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reacts to GitHub navigation events', () => {
    boot('/octo/repo/pull/7/files');
    go('/octo/repo/pull/7/commits');
    document.dispatchEvent(new Event('turbo:load'));
    expect(hosts()).toHaveLength(0);
    go('/octo/repo/pull/7/files');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(hosts()).toHaveLength(1);
  });

  it('aborts a running batch when the route changes', async () => {
    const files = Array.from({ length: 12 }, (_, i) => `src/f${i}.ts`);
    const current = boot('/octo/repo/pull/7/files', files);
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');

    const root = hosts()[0]?.shadowRoot;
    const open = root?.querySelector<HTMLButtonElement>('button.launcher');
    open?.click();
    await vi.waitFor(() => expect(root?.querySelector('.panel')).not.toBeNull());

    const filtered = [
      ...(root?.querySelectorAll<HTMLInputElement>('input[name="difftick-scope"]') ?? []),
    ].find((input) => input.value === 'filtered');
    filtered?.click();
    await vi.waitFor(() => expect(root?.querySelector('button.primary')).not.toBeNull());
    root?.querySelector<HTMLButtonElement>('button.primary')?.click();

    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    go('/octo/repo/pull/8/files');
    current.sync();
    const clicksAtRouteChange = click.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(click.mock.calls.length).toBeLessThanOrEqual(clicksAtRouteChange + 1);
    expect(click.mock.calls.length).toBeLessThan(files.length);
  });
});
