import { describe, expect, it } from 'vitest';
import {
  createFileRecord,
  getDirectory,
  getExtension,
  getName,
  isInFolder,
  normalizeExtension,
  normalizePath,
  parseExtensions,
} from '../../domain/path-utils';

describe('normalizePath', () => {
  it('strips leading ./ and /, trailing slash, backslashes and duplicate separators', () => {
    expect(normalizePath('./src//api\\')).toBe('src/api');
    expect(normalizePath('/src/api/')).toBe('src/api');
    expect(normalizePath('  src/api  ')).toBe('src/api');
    expect(normalizePath('')).toBe('');
    expect(normalizePath('/')).toBe('');
  });
});

describe('name / directory / extension', () => {
  it('handles root files, nested files and files without extension', () => {
    expect(getName('README.md')).toBe('README.md');
    expect(getDirectory('README.md')).toBe('');
    expect(getDirectory('src/Services/Nested/X.cs')).toBe('src/Services/Nested');
    expect(getExtension('Makefile')).toBeNull();
    expect(getExtension('src/Dockerfile')).toBeNull();
  });

  it('treats dotfiles as extensionless but keeps the last extension of dotted names', () => {
    expect(getExtension('.gitignore')).toBeNull();
    expect(getExtension('config/.env')).toBeNull();
    expect(getExtension('.eslintrc.json')).toBe('json');
    expect(getExtension('a/b/foo.test.ts')).toBe('ts');
    expect(getExtension('archive.tar.gz')).toBe('gz');
    expect(getExtension('weird.')).toBeNull();
  });

  it('lower-cases extensions and supports Unicode and spaces in names', () => {
    expect(getExtension('docs/Relatório Final.PDF')).toBe('pdf');
    expect(getName('docs/Relatório Final.PDF')).toBe('Relatório Final.PDF');
    expect(getExtension('src/日本語/ファイル.ÇS')).toBe('çs');
  });

  it('does not read an extension from a directory name', () => {
    expect(getExtension('v1.2/README')).toBeNull();
  });
});

describe('extension input', () => {
  it('normalises dots, wildcards and case', () => {
    expect(normalizeExtension('.CS')).toBe('cs');
    expect(normalizeExtension('*.ts')).toBe('ts');
    expect(normalizeExtension('tsx')).toBe('tsx');
    expect(normalizeExtension('  ..json ')).toBe('json');
  });

  it('parses lists separated by commas and whitespace, without duplicates', () => {
    expect(parseExtensions('.cs, ts  .TSX;cs')).toEqual(['cs', 'ts', 'tsx']);
    expect(parseExtensions('  ')).toEqual([]);
    expect(parseExtensions('.')).toEqual([]);
  });
});

describe('isInFolder', () => {
  it('matches whole segments at any depth', () => {
    expect(isInFolder('src/Services/A.cs', 'src/Services')).toBe(true);
    expect(isInFolder('src/Services/Nested/X.cs', 'src/Services')).toBe(true);
    expect(isInFolder('src/ServicesV2/Y.cs', 'src/Services')).toBe(false);
    expect(isInFolder('src/api-v2/x.ts', 'src/api')).toBe(false);
  });

  it('does not treat a file as inside a folder with the same name', () => {
    expect(isInFolder('src/Services', 'src/Services')).toBe(false);
  });

  it('only matches from the root, so same-named folders at other levels do not collide', () => {
    expect(isInFolder('lib/utils/a.ts', 'utils')).toBe(false);
    expect(isInFolder('utils/a.ts', 'utils')).toBe(true);
  });

  it('treats the empty folder as the root and can ignore case', () => {
    expect(isInFolder('a.ts', '')).toBe(true);
    expect(isInFolder('SRC/A.ts', 'src', false)).toBe(true);
    expect(isInFolder('SRC/A.ts', 'src', true)).toBe(false);
  });
});

describe('createFileRecord', () => {
  it('derives name, directory and extension from the full path', () => {
    expect(createFileRecord('./src/Services/CustomerService.cs', 'viewed', true)).toEqual({
      path: 'src/Services/CustomerService.cs',
      name: 'CustomerService.cs',
      directory: 'src/Services',
      extension: 'cs',
      viewedState: 'viewed',
      actionable: true,
    });
  });

  it('defaults to unknown and not actionable', () => {
    const record = createFileRecord('a.ts');
    expect(record.viewedState).toBe('unknown');
    expect(record.actionable).toBe(false);
  });
});
