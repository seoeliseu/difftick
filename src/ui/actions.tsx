import { useEffect, useRef } from 'preact/hooks';
import type { ConfirmRequest, PanelState, ReviewController, RunState } from '../content/controller';
import type { PanelView } from '../content/view';
import type { OperationResult } from '../domain/operations';
import type { ActionScope, ViewedAction } from '../domain/types';
import { strings } from './strings';

const SCOPES: ActionScope[] = ['selected', 'filtered', 'available'];

const ACTION_LABEL: Record<ViewedAction, string> = {
  'mark-viewed': 'Mark as viewed',
  'mark-unviewed': 'Mark as unviewed',
};

export function ActionBar({
  state,
  view,
  controller,
}: {
  state: PanelState;
  view: PanelView;
  controller: ReviewController;
}) {
  const locked = state.run !== null || state.confirm !== null;
  const counts: Record<ActionScope, number> = {
    selected: view.files.filter((f) => state.selection.has(f.path)).length,
    filtered: view.filtered.length,
    available: view.files.length,
  };
  const plan = view.plans['mark-viewed'];
  const ready = state.phase === 'ready' && !locked;

  return (
    <section class="actions" aria-label="Bulk actions">
      <fieldset class="scope">
        <legend>{strings.scopeLegend}</legend>
        {SCOPES.map((scope) => (
          <label key={scope}>
            <input
              type="radio"
              name="difftick-scope"
              value={scope}
              checked={state.scope === scope}
              disabled={locked}
              onChange={() => controller.setScope(scope)}
            />
            {strings.scope[scope]} ({counts[scope]})
          </label>
        ))}
      </fieldset>
      <p class="hint" id="difftick-scope-summary">
        {strings.scopeSummary(view.scopeFiles.length, plan.unavailable.length)}
      </p>
      <div class="buttons">
        <button
          type="button"
          class="primary"
          aria-describedby="difftick-scope-summary"
          disabled={!ready || view.plans['mark-viewed'].eligible.length === 0}
          onClick={() => controller.requestScopeAction('mark-viewed')}
        >
          {strings.markViewed(view.plans['mark-viewed'].eligible.length)}
        </button>
        <button
          type="button"
          aria-describedby="difftick-scope-summary"
          disabled={!ready || view.plans['mark-unviewed'].eligible.length === 0}
          onClick={() => controller.requestScopeAction('mark-unviewed')}
        >
          {strings.markUnviewed(view.plans['mark-unviewed'].eligible.length)}
        </button>
      </div>
    </section>
  );
}

export function ConfirmBar({
  request,
  controller,
}: {
  request: ConfirmRequest;
  controller: ReviewController;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmRef.current?.focus(), [request]);

  return (
    <section
      class="confirm"
      role="alertdialog"
      aria-labelledby="difftick-confirm-title"
      aria-describedby="difftick-confirm-body"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          controller.cancelConfirm();
        }
      }}
    >
      <h3 id="difftick-confirm-title">{strings.confirmTitle}</h3>
      <p id="difftick-confirm-body">
        {strings.confirmBody(
          ACTION_LABEL[request.action],
          request.eligible,
          request.label,
          strings.confirmWhy[request.why],
        )}
        {request.unavailable > 0 && <> {strings.confirmUnavailable(request.unavailable)}</>}
      </p>
      <div class="buttons">
        <button type="button" class="primary" ref={confirmRef} onClick={() => controller.confirm()}>
          {strings.confirm}
        </button>
        <button type="button" onClick={() => controller.cancelConfirm()}>
          {strings.cancel}
        </button>
      </div>
    </section>
  );
}

export function RunProgress({ run, controller }: { run: RunState; controller: ReviewController }) {
  const { progress } = run;
  return (
    <section class="progress" aria-label="Progress">
      <progress max={Math.max(progress.eligible, 1)} value={progress.processed}>
        {strings.progress(progress.processed, progress.eligible)}
      </progress>
      <p role="status" aria-live="polite">
        {strings.progress(progress.processed, progress.eligible)} ·{' '}
        {strings.runCounts(progress.succeeded, progress.failed)}
        {run.cancelling && <> · {strings.cancelling}</>}
      </p>
      <button type="button" disabled={run.cancelling} onClick={() => controller.cancelRun()}>
        {strings.cancelRun}
      </button>
    </section>
  );
}

function PathList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <details>
      <summary>{title}</summary>
      <ul class="paths">
        {items.slice(0, 200).map((item) => (
          <li key={item}>{item}</li>
        ))}
        {items.length > 200 && <li>…and {items.length - 200} more</li>}
      </ul>
    </details>
  );
}

export function ResultSummary({
  result,
  controller,
}: {
  result: OperationResult & { label: string };
  controller: ReviewController;
}) {
  const clean =
    result.status === 'completed' &&
    result.failed.length === 0 &&
    result.unavailable.length === 0 &&
    result.pending.length === 0;

  return (
    <section class="result" role="status" aria-live="polite" aria-label="Result">
      <h3>{strings.result.title(ACTION_LABEL[result.action], result.label)}</h3>
      {clean && <p>{strings.result.clean}</p>}
      {result.status === 'stopped' && result.reason && (
        <p class="warn">{strings.result.stopped(result.reason)}</p>
      )}
      {result.status === 'cancelled' && <p class="warn">{strings.result.cancelled}</p>}
      <ul class="tally">
        <li class="ok">{strings.result.succeeded(result.succeeded.length)}</li>
        <li class={result.failed.length ? 'bad' : ''}>
          {strings.result.failed(result.failed.length)}
        </li>
        <li>{strings.result.skipped(result.skipped.length)}</li>
        <li class={result.unavailable.length ? 'warn' : ''}>
          {strings.result.unavailable(result.unavailable.length)}
        </li>
        {result.pending.length > 0 && (
          <li class="warn">{strings.result.pending(result.pending.length)}</li>
        )}
      </ul>
      <PathList
        title={strings.result.failed(result.failed.length)}
        items={result.failed.map((f) => `${f.path} — ${f.message}`)}
      />
      <PathList
        title={strings.result.unavailable(result.unavailable.length)}
        items={result.unavailable.map((u) => `${u.path} — ${u.reason}`)}
      />
      {result.unavailable.length > 0 && <p class="hint">{strings.result.unavailableHelp}</p>}
      <div class="buttons">
        {result.failed.length > 0 && (
          <button type="button" class="primary" onClick={() => controller.retryFailed()}>
            {strings.result.retry}
          </button>
        )}
        <button type="button" onClick={() => controller.dismissResult()}>
          {strings.result.dismiss}
        </button>
      </div>
    </section>
  );
}
