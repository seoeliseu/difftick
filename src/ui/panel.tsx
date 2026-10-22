import { useMemo } from 'preact/hooks';
import type { ReviewController } from '../content/controller';
import { deriveView } from '../content/view';
import { hasActiveFilters } from '../domain/filter-files';
import { ActionBar, ConfirmBar, ResultSummary, RunProgress } from './actions';
import { TreeList } from './file-tree';
import { strings } from './strings';
import { useStore } from './use-store';

function Notices({
  phase,
  adapterKind,
  signedIn,
  known,
  actionable,
}: {
  phase: string;
  adapterKind: string;
  signedIn: boolean;
  known: number;
  actionable: number;
}) {
  return (
    <div class="notices">
      {phase === 'detecting' && <p class="notice">{strings.detecting}</p>}
      {phase === 'unsupported' && <p class="notice warn">{strings.unsupported}</p>}
      {phase === 'ready' && adapterKind === 'changes' && (
        <p class="notice">{strings.experimentalChanges}</p>
      )}
      {phase === 'ready' && known > 0 && actionable === 0 && (
        <p class="notice warn">
          {strings.noControls} {!signedIn && strings.signInHint}
        </p>
      )}
      {phase === 'ready' && actionable > 0 && actionable < known && (
        <p class="notice">{strings.partialCoverage(actionable, known)}</p>
      )}
    </div>
  );
}

export function Panel({ controller }: { controller: ReviewController }) {
  const state = useStore(controller.store);
  const view = useMemo(
    () => deriveView(state),
    [state.files, state.filters, state.selection, state.scope],
  );

  if (!state.open) {
    return (
      <button
        type="button"
        class="launcher"
        aria-expanded="false"
        onClick={() => controller.setOpen(true)}
      >
        <span aria-hidden="true">✓ </span>
        {strings.launcher(state.selection.size)}
      </button>
    );
  }

  const filtering = hasActiveFilters(state.filters);
  const busy = state.run !== null || state.confirm !== null;
  const interactive = state.phase === 'ready';

  return (
    <section class="panel" aria-label={strings.title}>
      <header>
        <div>
          <h2>{strings.title}</h2>
          <p class="tagline">{strings.tagline}</p>
        </div>
        <button
          type="button"
          class="icon"
          aria-label={strings.collapse}
          onClick={() => controller.setOpen(false)}
        >
          <span aria-hidden="true">–</span>
        </button>
      </header>

      <Notices
        phase={state.phase}
        adapterKind={state.adapterKind}
        signedIn={state.signedIn}
        known={view.files.length}
        actionable={view.actionableCount}
      />

      {interactive && (
        <>
          <div class="filters" role="search">
            <input
              type="search"
              aria-label={strings.searchLabel}
              placeholder={strings.searchPlaceholder}
              value={state.filters.query}
              onInput={(event) => controller.setFilters({ query: event.currentTarget.value })}
            />
            <input
              type="text"
              list="difftick-extensions"
              aria-label={strings.extensionLabel}
              placeholder={strings.extensionPlaceholder}
              value={state.filters.extensions}
              onInput={(event) => controller.setFilters({ extensions: event.currentTarget.value })}
            />
            <datalist id="difftick-extensions">
              {view.extensions.map(({ extension, count }) => (
                <option key={extension} value={`.${extension}`}>
                  {count}
                </option>
              ))}
            </datalist>
            <input
              type="text"
              aria-label={strings.folderLabel}
              placeholder={strings.folderPlaceholder}
              value={state.filters.folder}
              onInput={(event) => controller.setFilters({ folder: event.currentTarget.value })}
            />
            <button type="button" disabled={!filtering} onClick={() => controller.resetFilters()}>
              {strings.clearFilters}
            </button>
          </div>

          <div class="summary">
            <span class="counts">{strings.counts(view.filtered.length, view.files.length)}</span>
            <span class="selected">{strings.selected(state.selection.size)}</span>
          </div>
          <div class="buttons">
            <button
              type="button"
              disabled={view.filtered.length === 0}
              onClick={() => controller.selectAllMatching()}
            >
              {strings.selectAllMatching}
            </button>
            <button
              type="button"
              disabled={state.selection.size === 0}
              onClick={() => controller.clearSelection()}
            >
              {strings.clearSelection}
            </button>
          </div>

          <div class="tree-wrap">
            {view.files.length === 0 ? (
              <p class="empty">{strings.noFiles}</p>
            ) : view.filtered.length === 0 ? (
              <p class="empty">{strings.emptyMatches}</p>
            ) : (
              <TreeList
                nodes={view.tree}
                folders={view.folders}
                selection={state.selection}
                collapsed={state.collapsedFolders}
                forceOpen={filtering}
                busy={busy}
                controller={controller}
              />
            )}
          </div>

          {state.confirm && <ConfirmBar request={state.confirm} controller={controller} />}
          {state.run && <RunProgress run={state.run} controller={controller} />}
          {state.result && !state.run && (
            <ResultSummary result={state.result} controller={controller} />
          )}
          {!state.confirm && !state.run && (
            <ActionBar state={state} view={view} controller={controller} />
          )}
        </>
      )}

      <footer>{strings.notAffiliated}</footer>
    </section>
  );
}
