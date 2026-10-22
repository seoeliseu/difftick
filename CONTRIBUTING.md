# Contributing to DiffTick

Thanks for helping! Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## Setup

Node.js 20+ and npm.

```bash
git clone https://github.com/seoeliseu/difftick.git
cd difftick
npm ci
npm run check   # lint + typecheck + tests + build
```

Load `dist/` as an unpacked extension (see the [README](README.md#install-unpacked-in-chrome-brave-or-another-chromium-browser)). `npm run preview` serves a fake classic Files changed page for working on the panel without a real Pull Request.

## Ground rules

1. **No network, no storage, no permissions.** The extension makes no requests, stores nothing and asks for no browser permissions. `src/test/unit/privacy-and-manifest.test.ts` fails the build if that changes. A feature that needs any of it (for example the planned authenticated GraphQL mode) needs a discussion issue first.
2. **GitHub's native state is the source of truth.** Never "mark" anything visually in the panel only. Click the native control and verify the result. Never persist `Viewed` locally.
3. **Be honest about coverage.** Do not call a result a success for files that were not processed. Keep _known_, _actionable_ and _succeeded_ separate. Say _Available files_, never _entire PR_.
4. **Keep the layers apart.**
   - `src/domain/` is pure logic: no DOM, no GitHub selectors.
   - `src/github/` is the only place that knows GitHub's markup. Mark each selector in a comment as **verified** (captured from live GitHub, with a fixture) or **unverified**.
   - `src/content/` wires them, `src/ui/` renders.
5. **Fail safe.** An unrecognised page must result in "not reachable" or "unsupported", never in a guess that clicks something.
6. No `eval`, no HTML-string injection (`innerHTML =`, `insertAdjacentHTML`), no remote code. ESLint enforces the last two.

## Workflow

- Branch from `main`, keep PRs focused, and describe the behaviour change and how you tested it.
- Add or update tests with the change. Bug fixes need a test that fails without the fix.
- Run `npm run check` before pushing; CI runs the same commands plus `npm run format:check`.
- Format with `npm run format`.

## Tests

- `src/test/unit/` pure logic, adapters on DOM fixtures, manifest/privacy guards.
- `src/test/integration/` the controller, the navigation lifecycle and the panel in jsdom (batch runs, cancel, route change, confirmation rules).
- `src/test/fixtures/` HTML captured from live GitHub (trimmed; state when and how it was captured). `src/test/builders.ts` builds synthetic pages; **synthetic fixtures describe our assumptions, they are not evidence about GitHub**, so label them as such.

## When GitHub changes its markup

1. Reproduce on a real PR and capture the relevant snippet (see [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md)); strip anything private.
2. Add the capture as a fixture (or extend the profile's selector list) and a failing test.
3. Fix the profile in `src/github/classic-adapter.ts` or `changes-adapter.ts`; update the verified/unverified comments and the compatibility table in the README.

## Releasing

Bump `version` in `package.json` (it is copied into `manifest.json` at build time), run `npm run check`, and zip the contents of `dist/`. Review [PRIVACY.md](PRIVACY.md) before any Chrome Web Store submission.
