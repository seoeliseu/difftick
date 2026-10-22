# Privacy Policy

_Last updated: 2026-10-22. DiffTick is not affiliated with GitHub._

DiffTick is a browser extension that helps you mark files as **Viewed** in the _Files changed_ tab of GitHub Pull Requests. This policy describes exactly what it does with data.

## Summary

**DiffTick collects, stores and transmits no data.** It has no backend, no analytics, no telemetry, no accounts and no third-party services.

## What the extension reads

On `https://github.com/*` pages the content script checks the URL. Only on a Pull Request's `/files` or `/changes` page does it read, from the page you are already looking at:

- the file paths listed in the pull request, and
- the state of the page's own **Viewed** checkboxes.

This information is used in memory to show you the panel (filters, selection, counts). It is never written to disk and never leaves your browser.

## What the extension does

When, and only when, you press a _Mark as viewed_ / _Mark as unviewed_ button, DiffTick clicks GitHub's own **Viewed** checkboxes on the page, exactly as if you had clicked them yourself, and then checks that each checkbox ended up in the requested state. It does not submit reviews, approve, comment or change code.

## What the extension does not do

- It does not make any network request of its own (no `fetch`, no `XMLHttpRequest`, no beacons, no web sockets).
- It does not read or store GitHub tokens, cookies, credentials, CSRF tokens or the contents of your diffs.
- It does not use browser storage (no `localStorage`, `sessionStorage`, IndexedDB, cookies or `chrome.storage`). Your selection and filters live only in the open tab and disappear when you leave the Pull Request or close the tab.
- It does not execute remote code and does not load resources from other websites.

These properties are enforced by automated tests in this repository (`src/test/unit/privacy-and-manifest.test.ts`).

## Permissions

DiffTick requests **no browser permissions** (`permissions` and `host_permissions` are absent from `manifest.json`). It declares a single content script that is injected on `https://github.com/*`. The match pattern has to cover all of github.com because GitHub navigates between pages without reloading; the script does nothing outside Pull Request file pages. GitHub Enterprise Server and other sites are not supported and not matched.

## Children's privacy and changes

DiffTick processes no personal data from anyone, including children. If this changes in a future version (for example an optional, authenticated GitHub API mode), this policy will be updated before release and the new behaviour will be opt-in.

## Contact

Open an issue at <https://github.com/seoeliseu/difftick/issues>.
