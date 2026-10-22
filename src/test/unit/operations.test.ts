import { describe, expect, it, vi } from 'vitest';
import {
  isAllClear,
  planOperation,
  resolveScope,
  runOperation,
  ViewedOperationError,
  type OperationProgress,
} from '../../domain/operations';
import { selectFiles, EMPTY_SELECTION } from '../../domain/selection';
import { EMPTY_FILTERS } from '../../domain/types';
import { FakeGateway, file, files } from '../helpers';

const never = new AbortController().signal;

describe('resolveScope', () => {
  const all = files(['src/a.cs', 'src/b.cs', 'tests/c.cs', 'docs/d.md']);
  const selection = selectFiles(EMPTY_SELECTION, [all[0]!, all[3]!]);
  const filters = { ...EMPTY_FILTERS, folder: 'src' };

  it('resolves each scope from current state', () => {
    expect(resolveScope('selected', all, selection, filters).map((f) => f.path)).toEqual([
      'src/a.cs',
      'docs/d.md',
    ]);
    expect(resolveScope('filtered', all, selection, filters).map((f) => f.path)).toEqual([
      'src/a.cs',
      'src/b.cs',
    ]);
    expect(resolveScope('available', all, selection, filters)).toHaveLength(4);
  });

  it('ignores selected paths that are not in the catalog', () => {
    const stale = selectFiles(EMPTY_SELECTION, [file('gone.ts')]);
    expect(resolveScope('selected', all, stale, filters)).toEqual([]);
  });
});

describe('planOperation', () => {
  it('only plans files whose state needs to change (idempotency)', () => {
    const plan = planOperation('mark-viewed', [
      file('a.ts', 'unviewed'),
      file('b.ts', 'viewed'),
      file('c.ts', 'unviewed'),
    ]);
    expect(plan.eligible.map((f) => f.path)).toEqual(['a.ts', 'c.ts']);
    expect(plan.alreadyInState.map((f) => f.path)).toEqual(['b.ts']);
  });

  it('inverts the target for mark-unviewed', () => {
    const plan = planOperation('mark-unviewed', [file('a.ts', 'viewed'), file('b.ts', 'unviewed')]);
    expect(plan.eligible.map((f) => f.path)).toEqual(['a.ts']);
    expect(plan.alreadyInState.map((f) => f.path)).toEqual(['b.ts']);
  });

  it('treats non-actionable and unknown-state files as unavailable, never as eligible', () => {
    const plan = planOperation('mark-viewed', [
      file('virtualised.ts', 'unknown', false),
      file('stale.ts', 'viewed', false),
      file('nostate.ts', 'unknown', true),
      file('ok.ts', 'unviewed', true),
    ]);
    expect(plan.eligible.map((f) => f.path)).toEqual(['ok.ts']);
    expect(plan.unavailable.map((u) => u.path)).toEqual([
      'virtualised.ts',
      'stale.ts',
      'nostate.ts',
    ]);
  });
});

describe('runOperation', () => {
  it('RF-06 acceptance: 15 selected (5 already viewed) only touches the 10 that need it', async () => {
    const paths = Array.from({ length: 15 }, (_, i) => `src/f${i}.ts`);
    const initial = Object.fromEntries(
      paths.map((p, i) => [p, i < 5 ? 'viewed' : 'unviewed'] as const),
    );
    initial['src/outside.ts'] = 'unviewed';
    const gateway = new FakeGateway(initial);
    const plan = planOperation(
      'mark-viewed',
      paths.map((p, i) => file(p, i < 5 ? 'viewed' : 'unviewed')),
    );

    const result = await runOperation({ plan, gateway, signal: never });

    expect(gateway.calls).toEqual(paths.slice(5));
    expect(gateway.getViewedState('src/outside.ts')).toBe('unviewed');
    expect(result).toMatchObject({ status: 'completed', requested: 15 });
    expect(result.succeeded).toHaveLength(10);
    expect(result.skipped).toHaveLength(5);
    expect(result.failed).toEqual([]);
    expect(isAllClear(result)).toBe(true);
  });

  it('RF-09 acceptance: 100 known / 60 actionable never reports 100 successes', async () => {
    const known = Array.from({ length: 100 }, (_, i) =>
      file(`f${i}.ts`, i < 60 ? 'unviewed' : 'unknown', i < 60),
    );
    const gateway = new FakeGateway(
      Object.fromEntries(
        known.filter((f) => f.actionable).map((f) => [f.path, 'unviewed'] as const),
      ),
    );
    const result = await runOperation({
      plan: planOperation('mark-viewed', known),
      gateway,
      signal: never,
    });

    expect(result.requested).toBe(100);
    expect(result.succeeded).toHaveLength(60);
    expect(result.unavailable).toHaveLength(40);
    expect(isAllClear(result)).toBe(false);
  });

  it('keeps going after a single failure and reports it separately', async () => {
    const gateway = new FakeGateway(
      { 'a.ts': 'unviewed', 'b.ts': 'unviewed', 'c.ts': 'unviewed' },
      { failures: { 'b.ts': 'verification' } },
    );
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts', 'b.ts', 'c.ts'])),
      gateway,
      signal: never,
    });

    expect(result.status).toBe('completed');
    expect(result.succeeded).toEqual(['a.ts', 'c.ts']);
    expect(result.failed.map((f) => f.path)).toEqual(['b.ts']);
    expect(isAllClear(result)).toBe(false);
  });

  it('moves a click that GitHub silently reverted from success to failed', async () => {
    const gateway = new FakeGateway({ 'a.ts': 'unviewed' }, { reverting: ['a.ts'] });
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts'])),
      gateway,
      signal: never,
    });

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([{ path: 'a.ts', message: 'GitHub did not keep the new state' }]);
  });

  it('records a control that vanished as unavailable, not as a failure', async () => {
    const gateway = new FakeGateway(
      { 'a.ts': 'unviewed' },
      { failures: { 'a.ts': 'unavailable' } },
    );
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts'])),
      gateway,
      signal: never,
    });
    expect(result.unavailable.map((u) => u.path)).toEqual(['a.ts']);
    expect(result.failed).toEqual([]);
  });

  it('skips files that reached the target state after the plan was made', async () => {
    const gateway = new FakeGateway({ 'a.ts': 'viewed', 'b.ts': 'unviewed' });
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts', 'b.ts'])),
      gateway,
      signal: never,
    });
    expect(gateway.calls).toEqual(['b.ts']);
    expect(result.skipped).toEqual(['a.ts']);
  });

  it('stops safely on a fatal error and leaves the rest pending', async () => {
    const gateway = new FakeGateway(
      { 'a.ts': 'unviewed', 'b.ts': 'unviewed', 'c.ts': 'unviewed' },
      { failures: { 'b.ts': 'fatal' } },
    );
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts', 'b.ts', 'c.ts'])),
      gateway,
      signal: never,
    });

    expect(result.status).toBe('stopped');
    expect(result.succeeded).toEqual(['a.ts']);
    expect(result.failed.map((f) => f.path)).toEqual(['b.ts']);
    expect(result.pending).toEqual(['c.ts']);
    expect(gateway.calls).toEqual(['a.ts', 'b.ts']);
  });

  it('circuit-breaks after repeated failures instead of hammering the page', async () => {
    const paths = ['a', 'b', 'c', 'd', 'e'].map((n) => `${n}.ts`);
    const gateway = new FakeGateway(
      Object.fromEntries(paths.map((p) => [p, 'unviewed'] as const)),
      { failures: Object.fromEntries(paths.map((p) => [p, 'unknown'] as const)) },
    );
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(paths)),
      gateway,
      signal: never,
      maxConsecutiveFailures: 2,
    });

    expect(result.status).toBe('stopped');
    expect(gateway.calls).toEqual(['a.ts', 'b.ts']);
    expect(result.pending).toEqual(['c.ts', 'd.ts', 'e.ts']);
  });

  it('cancel stops new work, keeps completed work and reports the rest as pending', async () => {
    const controller = new AbortController();
    const gateway = new FakeGateway(
      { 'a.ts': 'unviewed', 'b.ts': 'unviewed', 'c.ts': 'unviewed' },
      { beforeSet: (path) => path === 'a.ts' && queueMicrotask(() => controller.abort()) },
    );
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts', 'b.ts', 'c.ts'])),
      gateway,
      signal: controller.signal,
    });

    expect(result.status).toBe('cancelled');
    expect(result.succeeded).toEqual(['a.ts']);
    expect(result.pending).toEqual(['b.ts', 'c.ts']);
    expect(gateway.getViewedState('b.ts')).toBe('unviewed');
    expect(isAllClear(result)).toBe(false);
  });

  it('does nothing when already aborted (e.g. route changed before the first item)', async () => {
    const controller = new AbortController();
    controller.abort();
    const gateway = new FakeGateway({ 'a.ts': 'unviewed' });
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts'])),
      gateway,
      signal: controller.signal,
    });
    expect(gateway.calls).toEqual([]);
    expect(result).toMatchObject({ status: 'cancelled', pending: ['a.ts'] });
  });

  it('handles an abort that arrives while an item is in flight', async () => {
    const controller = new AbortController();
    const gateway = new FakeGateway({ 'a.ts': 'unviewed', 'b.ts': 'unviewed' });
    vi.spyOn(gateway, 'setViewed').mockImplementation(() => {
      controller.abort();
      return Promise.reject(new ViewedOperationError('aborted', 'Aborted'));
    });
    const result = await runOperation({
      plan: planOperation('mark-viewed', files(['a.ts', 'b.ts'])),
      gateway,
      signal: controller.signal,
    });
    expect(result.status).toBe('cancelled');
    expect(result.succeeded).toEqual([]);
    expect(result.pending).toEqual(['a.ts', 'b.ts']);
  });

  it('reports progress as processed / eligible', async () => {
    const gateway = new FakeGateway({ 'a.ts': 'unviewed', 'b.ts': 'unviewed' });
    const updates: OperationProgress[] = [];
    await runOperation({
      plan: planOperation('mark-viewed', [...files(['a.ts', 'b.ts']), file('c.ts', 'viewed')]),
      gateway,
      signal: never,
      onProgress: (progress) => updates.push({ ...progress }),
    });

    const last = updates.at(-1);
    expect(last).toMatchObject({ processed: 2, eligible: 2, succeeded: 2, failed: 0, skipped: 1 });
    expect(updates.some((u) => u.processed === 1)).toBe(true);
  });
});
