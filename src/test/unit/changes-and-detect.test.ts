import { beforeEach, describe, expect, it } from 'vitest';
import { createChangesAdapter } from '../../github/changes-adapter';
import { detectAdapter, isSignedIn } from '../../github/detect-adapter';
import { changesPage, classicPage, type FixtureFile } from '../builders';

const timing = { timeoutMs: 120, pollMs: 5, settleMs: 20 };
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
  document.head.innerHTML = '';
});

// SYNTHETIC contract fixtures: these pin DiffTick's assumptions about the new layout.
// They are NOT evidence that github.com/…/changes renders this markup.
describe('changes adapter (heuristics on synthetic fixtures)', () => {
  it('lists files and reads Viewed state from a labelled checkbox', () => {
    document.body.innerHTML = changesPage([
      f('src/a.ts', true),
      f('src/b.ts', false),
      f('src/c.ts', null),
    ]);
    const adapter = createChangesAdapter(document, timing);

    const byPath = Object.fromEntries(adapter.listFiles().map((file) => [file.path, file]));
    expect(byPath['src/a.ts']).toMatchObject({ viewedState: 'viewed', actionable: true });
    expect(byPath['src/b.ts']).toMatchObject({ viewedState: 'unviewed', actionable: true });
    expect(byPath['src/c.ts']).toMatchObject({ viewedState: 'unknown', actionable: false });
  });

  it('ignores nested diff-… anchors inside a file', () => {
    document.body.innerHTML = changesPage([f('src/a.ts', false)]);
    expect(createChangesAdapter(document, timing).listFiles()).toHaveLength(1);
  });

  it('marks a file viewed through the native checkbox and verifies it', async () => {
    document.body.innerHTML = changesPage([f('src/a.ts', false)]);
    const adapter = createChangesAdapter(document, timing);
    await adapter.setViewed('src/a.ts', true);
    expect(adapter.getViewedState('src/a.ts')).toBe('viewed');
  });

  it('refuses to guess when a file has several Viewed-looking checkboxes', () => {
    document.body.innerHTML = `<section id="diff-aa" data-file-path="x.ts">
      <label><input type="checkbox"> Viewed</label><label><input type="checkbox" aria-label="Mark viewed"></label>
    </section>`;
    const [record] = createChangesAdapter(document, timing).listFiles();
    expect(record).toMatchObject({ path: 'x.ts', actionable: false, viewedState: 'unknown' });
  });

  it('ignores unrelated checkboxes', () => {
    document.body.innerHTML = `<section id="diff-aa" data-file-path="x.ts"><label><input type="checkbox"> Wrap lines</label></section>`;
    expect(createChangesAdapter(document, timing).listFiles()[0]?.actionable).toBe(false);
  });

  it('accepts a structural hint even when the label is not English', () => {
    document.body.innerHTML = `<section id="diff-aa" data-file-path="x.ts"><input type="checkbox" name="viewed-toggle"></section>`;
    expect(createChangesAdapter(document, timing).listFiles()[0]).toMatchObject({
      actionable: true,
      viewedState: 'unviewed',
    });
  });

  it('is unsupported without a recognisable path', () => {
    document.body.innerHTML =
      '<section id="diff-aa"><input type="checkbox" name="viewed"></section>';
    expect(createChangesAdapter(document, timing).isSupported()).toBe(false);
  });
});

describe('detectAdapter', () => {
  it('prefers the classic adapter when the classic markup is present', () => {
    document.body.innerHTML = classicPage([f('a.ts', false)]);
    expect(detectAdapter(document).kind).toBe('classic');
  });

  it('falls back to the changes adapter for the new layout', () => {
    document.body.innerHTML = changesPage([f('a.ts', false)]);
    expect(detectAdapter(document).kind).toBe('changes');
  });

  it('returns an unsupported adapter that cannot write for unknown or empty pages', async () => {
    document.body.innerHTML = '<main><p>Loading…</p></main>';
    const adapter = detectAdapter(document);
    expect(adapter.kind).toBe('unsupported');
    expect(adapter.isSupported()).toBe(false);
    expect(adapter.listFiles()).toEqual([]);
    expect(adapter.getViewedState('a.ts')).toBe('unknown');
    await expect(adapter.setViewed('a.ts', true)).rejects.toMatchObject({ kind: 'fatal' });
  });

  it('picks up diffs that render after the first check', () => {
    document.body.innerHTML = '<main>Loading…</main>';
    expect(detectAdapter(document).kind).toBe('unsupported');
    document.body.innerHTML = classicPage([f('a.ts', false)]);
    expect(detectAdapter(document).kind).toBe('classic');
  });
});

describe('isSignedIn (diagnostics only)', () => {
  it('reads the user-login meta', () => {
    expect(isSignedIn(document)).toBe(false);
    document.head.innerHTML = '<meta name="user-login" content="">';
    expect(isSignedIn(document)).toBe(false);
    document.head.innerHTML = '<meta name="user-login" content="octocat">';
    expect(isSignedIn(document)).toBe(true);
  });
});
