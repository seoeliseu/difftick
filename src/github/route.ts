export type PrView = 'files' | 'changes';

export interface PrRoute {
  owner: string;
  repo: string;
  number: number;
  view: PrView;
  /** Anything after `/files` or `/changes` (e.g. a commit range). Different suffix = different file set. */
  suffix: string;
  /** Identity of the file set being reviewed; the panel is rebuilt when it changes. */
  key: string;
}

const ROUTE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(files|changes)(?:\/(.+?))?\/?$/;

/**
 * Parses a github.com pathname into a PR file-review route.
 * Query strings and hashes are ignored (pass `location.pathname`).
 */
export function parsePrRoute(hostname: string, pathname: string): PrRoute | null {
  if (hostname !== 'github.com') return null;
  const match = ROUTE.exec(pathname);
  if (!match) return null;

  const [, owner, repo, number, view, suffix = ''] = match;
  if (!owner || !repo || !number || (view !== 'files' && view !== 'changes')) return null;

  const key = `${owner}/${repo}#${number}${suffix ? `/${suffix}` : ''}`.toLowerCase();
  return { owner, repo, number: Number(number), view, suffix, key };
}
