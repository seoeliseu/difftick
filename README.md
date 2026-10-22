# DiffTick

> **Review smarter. Mark faster.**

An open-source browser extension that enhances GitHub Pull Request reviews with bulk file marking, smart filters, and recursive folder selection.

DiffTick adds a small panel to a Pull Request's **Files changed** tab. It lets you filter files, select many of them (or a whole folder, subfolders included) and flip GitHub's own **Viewed** checkbox for all of them in one go.

> **Not affiliated with GitHub.** DiffTick is an independent project. "GitHub" is a trademark of GitHub, Inc.

## Status: first version, needs real-GitHub validation

The domain logic, the panel and the batch queue are implemented and covered by automated tests. What could **not** be verified while building it is the exact markup of GitHub's _signed-in_ **Viewed** control and of the _new_ `/changes` layout. See [Compatibility](#compatibility) and [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) before relying on it. When DiffTick cannot find a native control it reports the file as _not reachable_ and writes nothing.

## Features

- **Selection is not marking.** Checking boxes in the DiffTick panel only selects; nothing changes on GitHub until you press a _Mark as viewed_ / _Mark as unviewed_ button.
- **Combinable filters** (AND): case-insensitive name/path search, extension (`.cs`, `cs`, `.ts .tsx`) and folder (whole-segment match: `src/api` never matches `src/api-v2`). `N matching / M available` counter.
- **Selection that survives filtering**: _Select all matching_ adds to the selection, _Clear selection_ clears everything, including items the current filter hides.
- **Recursive folder selection** with tri-state checkboxes, plus _Mark_ / _Unmark_ quick actions per folder.
- **Explicit scope** for every bulk action: _Selected_, _Filtered_ or _Available_ (files DiffTick currently knows about, never labelled "entire PR"). A live preview shows how many files will actually change.
- **Idempotent and verified**: files already in the target state are skipped; after each native click DiffTick checks that GitHub's own checkbox really ended up in the new state, and re-reads everything at the end.
- **Honest results**: _succeeded_, _failed_, _skipped_ (already done), _not reachable_ and _not processed_ are reported separately. Failed files can be retried.
- **Safe by default**: confirmation for more than 25 changes, for the _Available_ scope and for folder actions; sequential processing, a _Cancel_ button (new work stops, nothing is rolled back), stop on fatal errors or repeated failures, no automatic retries.
- Light/dark themes (uses GitHub's own colour variables), keyboard operable, labelled controls, `aria-live` progress.
- No account, no token, no backend, no telemetry, no permissions. See [PRIVACY.md](PRIVACY.md).

## Install (unpacked) in Chrome, Brave or another Chromium browser

Requirements: Node.js 20 or newer and npm.

```bash
git clone https://github.com/seoeliseu/difftick.git
cd difftick
npm ci
npm run build
```

The extension is now in the **`dist/`** folder (for example `C:\r\difftick\dist` on Windows). Then:

1. Open `chrome://extensions` (Brave: `brave://extensions`, Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the **`dist`** directory (the one that contains `manifest.json`).
4. Open a Pull Request's **Files changed** tab on `github.com`, e.g. `https://github.com/OWNER/REPO/pull/123/files`.
5. Click the **✓ DiffTick** button at the bottom-right of the page to open the panel.

After changing the code run `npm run build` again (or `npm run dev` to rebuild on save) and press the reload icon on the extension card, then reload the GitHub tab.

## Using it

1. Filter (optional): type in _Search_, _Extensions_ and/or _Folder_.
2. Select files with their checkboxes, a folder checkbox (all descendants, ignores filters) or _Select all matching_.
3. Choose the scope under **Apply to**, check the summary line and press **Mark as viewed (N)** or **Mark as unviewed (N)**. The number is how many files will really change.
4. Confirm when asked. Watch the progress; press **Cancel** to stop new work.
5. Read the result. If anything is _not reachable_, expand or scroll to those diffs on the page and run the action again.

## Compatibility

GitHub is changing the Files changed page (a new React-based layout served at `/changes`, with virtualised diffs). DiffTick keeps everything layout-specific in two adapters and detects the layout from the DOM, not from the URL.

| Area                                                   | Status                                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Route detection (`/files`, `/changes`, SPA navigation) | Unit/integration tested                                                                                                                      |
| Classic layout: file containers, paths, file tree      | **Verified** against markup captured from live github.com (signed out): [fixture](src/test/fixtures/classic-captured-signed-out.html)        |
| Classic layout: the signed-in **Viewed** checkbox      | **Unverified.** Only visible when signed in; selectors in [`classic-adapter.ts`](src/github/classic-adapter.ts) need manual checking         |
| New `/changes` layout                                  | **Unverified, experimental.** Generic heuristics tested on _synthetic_ fixtures only ([`changes-adapter.ts`](src/github/changes-adapter.ts)) |
| End-to-end on real Pull Requests                       | **Not done.** Follow [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md)                                                                        |

### Limits you should know about

- DiffTick can only act on files whose native **Viewed** control is present in the page. In a virtualised or lazily loaded diff list, files that are not rendered are _known_ (when the file tree lists them) but _not reachable_, and DiffTick says so instead of reporting success. It does not scroll the page for you and never calls undocumented GitHub endpoints.
- Cancelling does not undo files already marked. There is no rollback.
- `Viewed` is GitHub's own per-file flag, not a review or an approval. GitHub may clear it when a file changes again.
- GitHub Enterprise Server is not supported in this version. Complete coverage of huge Pull Requests would need the authenticated GraphQL API (`markFileAsViewed`), planned for a later version, not this one.
- The panel floats at the bottom-right of the page (collapsible) instead of being embedded in GitHub's layout, to avoid depending on fragile anchor selectors.

## Development

```bash
npm ci
npm run check        # lint + typecheck + tests + build
```

| Command             | What it does                                                |
| ------------------- | ----------------------------------------------------------- |
| `npm run build`     | Production build into `dist/`                               |
| `npm run dev`       | Rebuild `dist/` on every change                             |
| `npm test`          | Vitest (unit, DOM and integration tests, jsdom)             |
| `npm run lint`      | ESLint (type-aware)                                         |
| `npm run typecheck` | `tsc --noEmit`, strict mode                                 |
| `npm run format`    | Prettier                                                    |
| `npm run preview`   | Dev server with a **fake** classic page to try the panel/UI |
| `npm run icons`     | Regenerate the PNG icons (committed; rarely needed)         |

The preview page (`/dev/preview.html`, options `?theme=dark`, `?flaky=1`, `?files=300`, `?hidden=20`) imitates GitHub's classic markup with fake files. It exercises the panel and the queue, not live GitHub.

### Layout

```text
src/content/   bootstrap, SPA navigation lifecycle, controller (state + batch runs)
src/github/    route parser, adapter contract, shared DOM adapter, classic/changes profiles, detection
src/domain/    paths, filters, tree, selection, catalog, operation planning and queue (no DOM, no GitHub)
src/ui/        Preact panel, strings (en), styles (Shadow DOM)
src/test/      builders, fixtures, unit and integration tests
dev/           manual preview harness
```

The domain layer knows nothing about GitHub's markup. Everything that depends on it lives in `src/github/`, with each selector marked **verified** or **unverified**.

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). If a selector stops matching or a layout is not recognised, the bug template tells you what to capture (never paste private code).

## License

[MIT](LICENSE) © 2026 Eliseu Mendes de Morais

---

### Resumo em português

DiffTick é uma extensão (Chrome, Brave e outros Chromium) que adiciona, na aba **Files changed** de um Pull Request no GitHub, filtros, seleção múltipla, seleção recursiva de pastas e marcação/desmarcação em lote do estado nativo **Viewed**. Instalação: `npm ci && npm run build`, depois `chrome://extensions` → **Modo do desenvolvedor** → **Carregar sem compactação** → pasta **`dist`**. Sem token, sem backend, sem telemetria. Os seletores do controle **Viewed** (logado) e do novo layout `/changes` ainda **precisam de validação manual** em um PR real: veja [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md). Arquivos sem controle acionável na página são reportados como _não alcançáveis_, nunca como sucesso.
