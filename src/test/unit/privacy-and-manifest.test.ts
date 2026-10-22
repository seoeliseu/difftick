import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'src', 'manifest.json'), 'utf8')) as Record<
  string,
  unknown
>;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'test' ? [] : sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(name) ? [full] : [];
  });
}

describe('manifest', () => {
  it('is Manifest V3 and requests no permissions at all', () => {
    expect(manifest.manifest_version).toBe(3);
    for (const key of [
      'permissions',
      'optional_permissions',
      'host_permissions',
      'optional_host_permissions',
      'background',
      'externally_connectable',
      'web_accessible_resources',
      'declarative_net_request',
      'content_security_policy',
    ]) {
      expect(manifest, key).not.toHaveProperty(key);
    }
  });

  it('injects a single isolated content script on github.com only', () => {
    const scripts = manifest.content_scripts as Array<Record<string, unknown>>;
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatchObject({
      matches: ['https://github.com/*'],
      js: ['content.js'],
      world: 'ISOLATED',
    });
    expect(scripts[0]).not.toHaveProperty('all_frames', true);
  });

  it('declares its icons', () => {
    expect(Object.values(manifest.icons as Record<string, string>).sort()).toEqual([
      'icons/icon-128.png',
      'icons/icon-16.png',
      'icons/icon-48.png',
    ]);
  });
});

describe('privacy guard: shipped source never talks to the network or stores anything', () => {
  const forbidden: Array<[string, RegExp]> = [
    ['fetch()', /\bfetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['sendBeacon', /sendBeacon/],
    ['WebSocket', /WebSocket/],
    ['EventSource', /EventSource/],
    ['eval()', /\beval\s*\(/],
    ['new Function', /new Function/],
    ['dynamic import()', /\bimport\s*\(/],
    ['chrome.* extension APIs', /\bchrome\./],
    ['browser storage', /localStorage|sessionStorage|indexedDB|document\.cookie/],
    ['HTML string injection', /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/],
    ['remote URLs', /https?:\/\/(?!github\.com\/(?:\*|\S*pull))/],
  ];
  const files = sourceFiles(join(root, 'src'));

  it('scans a meaningful set of files', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(forbidden)('contains no %s', (_label, pattern) => {
    const offenders = files
      .filter((file) => pattern.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file));
    expect(offenders).toEqual([]);
  });
});
