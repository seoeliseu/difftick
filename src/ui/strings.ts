/**
 * All user-visible text lives here so the UI can be localised later (pt-BR is planned).
 * Plural-aware helpers are functions; plain labels are strings.
 */
const plural = (count: number, one: string, other = `${one}s`): string =>
  `${count} ${count === 1 ? one : other}`;

export const strings = {
  title: 'DiffTick',
  tagline: 'Review smarter. Mark faster.',
  notAffiliated: 'Not affiliated with GitHub.',

  open: 'Open DiffTick',
  collapse: 'Collapse DiffTick',
  launcher: (selected: number) => (selected > 0 ? `DiffTick · ${selected} selected` : 'DiffTick'),

  searchLabel: 'Search name or path',
  searchPlaceholder: 'Search name or path…',
  extensionLabel: 'Extensions',
  extensionPlaceholder: 'Extensions, e.g. .cs .ts',
  folderLabel: 'Folder filter',
  folderPlaceholder: 'Folder, e.g. src/Services',
  clearFilters: 'Clear filters',

  counts: (matching: number, available: number) => `${matching} matching / ${available} available`,
  selected: (n: number) => `${n} selected`,
  selectAllMatching: 'Select all matching',
  clearSelection: 'Clear selection',
  emptyMatches: 'No files match the current filters.',
  noFiles: 'No files found yet.',

  folderToggle: (path: string, expanded: boolean) =>
    `${expanded ? 'Collapse' : 'Expand'} folder ${path}`,
  folderSelect: (path: string, count: number) =>
    `Select all ${plural(count, 'file')} in ${path}, including subfolders (ignores filters)`,
  fileSelect: (path: string) => `Select ${path}`,
  folderMark: 'Mark',
  folderUnmark: 'Unmark',
  folderMarkLabel: (path: string) => `Mark folder ${path} as viewed`,
  folderUnmarkLabel: (path: string) => `Unmark folder ${path}`,

  state: { viewed: 'Viewed', unviewed: 'Unviewed', unknown: 'State unknown' },
  notReachable: 'Not reachable',

  scopeLegend: 'Apply to',
  scope: {
    selected: 'Selected',
    filtered: 'Filtered',
    available: 'Available',
  },
  markViewed: (changes: number) => `Mark as viewed (${changes})`,
  markUnviewed: (changes: number) => `Mark as unviewed (${changes})`,
  scopeSummary: (inScope: number, unavailable: number) => {
    const parts = [`${plural(inScope, 'file')} in scope`];
    if (unavailable > 0) parts.push(`${unavailable} not reachable`);
    return `${parts.join(' · ')}. Only files whose state differs will change.`;
  },
  nothingToDo: 'Nothing to change in this scope.',

  detecting: 'Looking for changed files…',
  unsupported:
    'DiffTick does not recognise this Files changed layout, so it is read-only here. Nothing will be modified.',
  experimentalChanges:
    'Experimental: support for the new Files changed layout is unverified. Check results on GitHub.',
  noControls: 'No native "Viewed" controls were found on this page.',
  signInHint: 'Sign in to GitHub and open the Files changed tab to use them.',
  partialCoverage: (actionable: number, known: number) =>
    `${actionable} of ${plural(known, 'known file')} can be changed right now. The rest have no reachable "Viewed" control — expand or scroll to their diffs, then try again. DiffTick never changes files it cannot reach.`,

  confirmTitle: 'Confirm bulk change',
  confirmBody: (action: string, eligible: number, label: string, why: string) =>
    `${action}: ${plural(eligible, 'file')} in “${label}”. ${why}`,
  confirmWhy: {
    large: 'This is a large change.',
    available:
      'This covers every file DiffTick currently knows about, not necessarily the whole PR.',
    folder: 'Includes all subfolders.',
  },
  confirmUnavailable: (n: number) => `${n} not reachable and will be skipped.`,
  confirmChanged: 'More files would change than before; please confirm again.',
  confirm: 'Confirm',
  cancel: 'Cancel',

  progress: (processed: number, eligible: number) => `Processing ${processed} / ${eligible}`,
  cancelling: 'Cancelling after the current file…',
  cancelRun: 'Cancel',
  runCounts: (s: number, f: number) => `Succeeded ${s} · Failed ${f}`,

  result: {
    title: (action: string, label: string) => `${action} — ${label}`,
    succeeded: (n: number) => `Succeeded: ${n}`,
    failed: (n: number) => `Failed: ${n}`,
    skipped: (n: number) => `Skipped (already in that state): ${n}`,
    unavailable: (n: number) => `Not reachable: ${n}`,
    pending: (n: number) => `Not processed: ${n}`,
    stopped: (reason: string) => `Stopped: ${reason}`,
    cancelled: 'Cancelled. Changes already made were kept; nothing was rolled back.',
    unavailableHelp: 'Expand or scroll to those diffs on the page, then run the action again.',
    retry: 'Retry failed',
    dismiss: 'Dismiss',
    clean: 'Done. Every file was verified in its new state.',
  },
} as const;

export type Strings = typeof strings;
