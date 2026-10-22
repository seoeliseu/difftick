import { describe, expect, it } from 'vitest';
import {
  clearFilters,
  collectExtensions,
  filterFiles,
  hasActiveFilters,
} from '../../domain/filter-files';
import { EMPTY_FILTERS, type Filters } from '../../domain/types';
import { files } from '../helpers';

const catalog = files([
  'src/Services/CustomerService.cs',
  'src/Services/PaymentService.cs',
  'src/Services/Nested/OrderService.cs',
  'src/ServicesV2/Other.cs',
  'src/Domain/Customer.cs',
  'tests/Services/CustomerServiceTests.cs',
  'src/Services/appsettings.json',
  'README.md',
  '.gitignore',
  'Makefile',
]);

const paths = (filters: Partial<Filters>) =>
  filterFiles(catalog, { ...EMPTY_FILTERS, ...filters }).map((f) => f.path);

describe('filterFiles', () => {
  it('returns everything for empty filters', () => {
    expect(paths({})).toHaveLength(catalog.length);
  });

  it('searches the full path case-insensitively', () => {
    expect(paths({ query: 'CUSTOMER' })).toEqual([
      'src/Services/CustomerService.cs',
      'src/Domain/Customer.cs',
      'tests/Services/CustomerServiceTests.cs',
    ]);
    expect(paths({ query: 'tests/' })).toEqual(['tests/Services/CustomerServiceTests.cs']);
  });

  it('accepts extensions with or without a dot', () => {
    const withDot = paths({ extensions: '.json' });
    expect(withDot).toEqual(['src/Services/appsettings.json']);
    expect(paths({ extensions: 'json' })).toEqual(withDot);
    expect(paths({ extensions: '.JSON' })).toEqual(withDot);
  });

  it('supports several extensions at once and excludes extensionless files', () => {
    expect(paths({ extensions: 'md, json' }).sort()).toEqual(
      ['README.md', 'src/Services/appsettings.json'].sort(),
    );
    expect(paths({ extensions: 'gitignore' })).toEqual([]);
  });

  it('matches folders on segment boundaries', () => {
    const result = paths({ folder: 'src/Services/' });
    expect(result).toContain('src/Services/Nested/OrderService.cs');
    expect(result).not.toContain('src/ServicesV2/Other.cs');
    expect(result).not.toContain('tests/Services/CustomerServiceTests.cs');
  });

  it('combines criteria with AND', () => {
    expect(paths({ query: 'service', extensions: '.cs', folder: 'src/' })).toEqual([
      'src/Services/CustomerService.cs',
      'src/Services/PaymentService.cs',
      'src/Services/Nested/OrderService.cs',
      // The query is a substring of the whole path, and `ServicesV2` contains `service`.
      'src/ServicesV2/Other.cs',
    ]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(paths({ query: 'does-not-exist' })).toEqual([]);
  });
});

describe('filter state helpers', () => {
  it('detects active filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, extensions: '.' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, folder: 'src' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, extensions: 'cs' })).toBe(true);
  });

  it('clearFilters returns a fresh empty state', () => {
    expect(clearFilters()).toEqual(EMPTY_FILTERS);
    expect(clearFilters()).not.toBe(EMPTY_FILTERS);
  });
});

describe('collectExtensions', () => {
  it('counts extensions, most common first, skipping extensionless files', () => {
    expect(collectExtensions(catalog)).toEqual([
      { extension: 'cs', count: 6 },
      { extension: 'json', count: 1 },
      { extension: 'md', count: 1 },
    ]);
  });
});
