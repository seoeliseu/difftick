import { describe, expect, it } from 'vitest';
import { parsePrRoute } from '../../github/route';

describe('parsePrRoute', () => {
  it('recognises /files and /changes', () => {
    expect(parsePrRoute('github.com', '/octo/repo/pull/12/files')).toMatchObject({
      owner: 'octo',
      repo: 'repo',
      number: 12,
      view: 'files',
      key: 'octo/repo#12',
    });
    expect(parsePrRoute('github.com', '/octo/repo/pull/12/changes')).toMatchObject({
      view: 'changes',
      key: 'octo/repo#12',
    });
  });

  it('keeps /files and /changes of the same PR on one panel key', () => {
    const files = parsePrRoute('github.com', '/o/r/pull/1/files');
    const changes = parsePrRoute('github.com', '/o/r/pull/1/changes');
    expect(files?.key).toBe(changes?.key);
  });

  it('tolerates a trailing slash and keeps commit ranges as part of the key', () => {
    expect(parsePrRoute('github.com', '/o/r/pull/1/files/')?.key).toBe('o/r#1');
    const range = parsePrRoute('github.com', '/o/r/pull/1/files/abc123..def456');
    expect(range).toMatchObject({ suffix: 'abc123..def456', key: 'o/r#1/abc123..def456' });
    expect(parsePrRoute('github.com', '/o/r/pull/1/changes/abc123')?.key).toBe('o/r#1/abc123');
  });

  it('treats owner and repo case-insensitively in the key', () => {
    expect(parsePrRoute('github.com', '/Octo/Repo/pull/3/files')?.key).toBe('octo/repo#3');
  });

  it('ignores every other page', () => {
    for (const path of [
      '/',
      '/o/r',
      '/o/r/pull/1',
      '/o/r/pull/1/commits',
      '/o/r/pull/1/checks',
      '/o/r/pulls',
      '/o/r/pull/abc/files',
      '/o/r/issues/1/files',
      '/o/r/pull/1/filesx',
    ]) {
      expect(parsePrRoute('github.com', path), path).toBeNull();
    }
  });

  it('only runs on github.com', () => {
    expect(parsePrRoute('gist.github.com', '/o/r/pull/1/files')).toBeNull();
    expect(parsePrRoute('github.example.com', '/o/r/pull/1/files')).toBeNull();
    expect(parsePrRoute('evil.com', '/o/r/pull/1/files')).toBeNull();
  });
});
