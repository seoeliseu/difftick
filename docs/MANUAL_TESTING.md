# Manual testing on real GitHub

Automated tests run against fixtures. Two things in them are **assumptions that only a real, signed-in GitHub page can confirm**:

1. the markup of the native **Viewed** checkbox in the classic Files changed layout (`CLASSIC_VIEWED_CONTROL_SELECTORS` in `src/github/classic-adapter.ts`), and
2. everything about the new `/changes` layout (`src/github/changes-adapter.ts`).

Run this checklist before trusting a build, and after GitHub ships layout changes.

> Use a Pull Request you can safely mark files on (your own, or a throw-away one). `Viewed` is saved on your account for that PR. Never paste private source code into issues.

## 0. Load the build

```bash
npm ci && npm run build
```

`chrome://extensions` (Brave: `brave://extensions`) → **Developer mode** → **Load unpacked** → select `dist/`. After rebuilding, click the reload icon on the extension card and reload the GitHub tab.

## 1. Which layout am I on?

Open `https://github.com/OWNER/REPO/pull/N/files`, then try `/changes`. Open DevTools → Console on the page and run:

```js
({
  classicFiles: document.querySelectorAll('div.file.js-file').length,
  anchors: document.querySelectorAll('[id^="diff-"]').length,
  tree: document.querySelectorAll('li[role="treeitem"][data-tree-entry-type="file"]').length,
  viewedLike: [...document.querySelectorAll('input[type="checkbox"]')].filter((el) =>
    /viewed/i.test(`${el.name} ${el.id} ${el.className} ${el.closest('label')?.textContent}`),
  ).length,
});
```

Write down which route served which layout. Expand the panel: the notice area should say nothing alarming for the classic layout, or show the _Experimental_ notice for `/changes`.

## 2. Capture the Viewed control (only if something is "not reachable")

Right-click a file's **Viewed** checkbox → Inspect, then in the Console run `copy($0.closest('form, label, div').outerHTML)` and compare with the selectors. If DiffTick shows _No native "Viewed" controls were found_ while you are signed in, the selectors need updating: open an issue with that snippet (remove anything private), your browser version and which layout you used.

## 3. Checklist

Tick each item on a PR with about 10 files, then on one with 100+ files, including deep folders and files already marked as Viewed.

- [ ] Panel appears exactly once on `/files` and `/changes`; it disappears on the Conversation/Commits tabs and reappears on return (no reload).
- [ ] Navigating from one PR to another builds a fresh panel (selection is empty).
- [ ] The file count matches the page (no duplicates from tree + diff).
- [ ] Search is case-insensitive; `.cs`, `cs` and `.cs .ts` all work; the folder filter does not match look-alike prefixes (`src/api` vs `src/api-v2`).
- [ ] Select files, change the filter, select more, clear the filter: nothing was marked on GitHub; _Clear selection_ empties everything.
- [ ] A folder checkbox selects all descendants (including subfolders) and shows the indeterminate state when partly selected.
- [ ] _Mark as viewed_ on **Selected** changes only the selected files; files already viewed are skipped; the GitHub checkboxes and the sidebar progress ("x / y viewed") agree with the DiffTick result.
- [ ] _Mark as unviewed_ reverses it.
- [ ] Reload the page: the files you marked are still viewed (the change really persisted on GitHub).
- [ ] **Available** scope asks for confirmation and the wording says "files DiffTick currently knows about".
- [ ] On a large PR, files whose diff is not rendered are reported as _not reachable_ (never counted as succeeded). Expanding/scrolling to them and re-running marks them.
- [ ] Folder _Mark_ / _Unmark_ confirm the scope first and do not touch sibling folders.
- [ ] **Cancel** mid-run stops new work; already marked files stay marked.
- [ ] Navigating to another tab/PR mid-run stops further clicks.
- [ ] Signed out: the panel explains that no native Viewed controls were found and offers no write actions that could succeed.
- [ ] Light and dark themes (and a high-contrast theme) are readable; keyboard-only operation works (Tab, Space, Enter, Esc closes the confirmation).
- [ ] No errors from DiffTick in the Console. No requests from DiffTick in the Network tab.
- [ ] Timing: note how long ~50 files take. The pace is intentionally conservative (about 0.3 s per file); report if it feels too slow or if GitHub throttles you.

## 4. Reporting

Fill the **Bug report** issue template: browser and version, layout (`/files` classic or `/changes`), signed in or not, PR size, expected vs actual, and the sanitised DOM snippet if a control was not found.
