import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewController } from '../../content/controller';
import { HOST_ATTRIBUTE, mountPanel, type MountedPanel } from '../../ui/mount';
import { classicPage, type FixtureFile } from '../builders';

const timing = { timeoutMs: 150, pollMs: 2, settleMs: 5 };
let controller: ReviewController | null = null;
let panel: MountedPanel | null = null;

const f = (path: string, viewed: boolean | null = false): FixtureFile => ({ path, viewed });

interface BootOptions {
  itemDelayMs?: number;
  detectionGraceMs?: number;
  open?: boolean;
}

/** Mounts the panel and starts the controller inside act(), so effects are flushed before asserting. */
async function boot(html: string, options: BootOptions = {}) {
  document.body.innerHTML = html;
  await act(() => {
    controller = new ReviewController({
      document,
      timing,
      itemDelayMs: options.itemDelayMs ?? 0,
      detectionGraceMs: options.detectionGraceMs ?? 0,
    });
    panel = mountPanel(document, controller);
    controller.start();
  });
  const c = controller as unknown as ReviewController;
  if (options.open ?? true) await act(() => c.setOpen(true));
  return { controller: c, root: (panel as unknown as MountedPanel).host.shadowRoot as ShadowRoot };
}

function mount(files: FixtureFile[], treeOnly: string[] = [], open = true) {
  return boot(classicPage(files, treeOnly), { open });
}

const q = <T extends Element = HTMLElement>(root: ParentNode, selector: string) =>
  root.querySelector<T>(selector);
const qa = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => [
  ...root.querySelectorAll<T>(selector),
];
const byText = (root: ParentNode, selector: string, text: string | RegExp) =>
  qa<HTMLButtonElement>(root, selector).find((el) =>
    typeof text === 'string' ? el.textContent?.includes(text) : text.test(el.textContent ?? ''),
  );

async function type(input: HTMLInputElement, value: string) {
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(element: HTMLElement | null | undefined) {
  if (!element) throw new Error('element not found');
  await act(() => element.click());
}
const rowLabels = (root: ParentNode) => qa(root, 'li.file .name').map((el) => el.textContent);

afterEach(() => {
  panel?.unmount();
  controller?.dispose();
  panel = null;
  controller = null;
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-color-mode');
});

describe('panel shell', () => {
  it('shows a discreet launcher first, then the panel with the tagline', async () => {
    const { root } = await mount([f('a.ts')], [], false);
    expect(q(root, 'button.launcher')?.textContent).toContain('DiffTick');
    expect(q(root, '.panel')).toBeNull();

    await click(q(root, 'button.launcher'));
    expect(q(root, '.panel h2')?.textContent).toBe('DiffTick');
    expect(q(root, '.tagline')?.textContent).toBe('Review smarter. Mark faster.');
    expect(q(root, 'footer')?.textContent).toContain('Not affiliated with GitHub');
  });

  it('never duplicates the panel host', async () => {
    await mount([f('a.ts')]);
    panel?.unmount();
    const second = new ReviewController({ document, timing });
    const again = mountPanel(document, second);
    const third = mountPanel(document, second);
    expect(document.querySelectorAll(`[${HOST_ATTRIBUTE}]`)).toHaveLength(1);
    third.unmount();
    again.unmount();
    second.dispose();
  });

  it('is isolated in a shadow root and follows the GitHub colour mode', async () => {
    document.documentElement.setAttribute('data-color-mode', 'dark');
    const { root } = await mount([f('a.ts')]);
    const host = document.querySelector(`[${HOST_ATTRIBUTE}]`);
    expect(host?.getAttribute('data-theme')).toBe('dark');
    expect(document.body.querySelector('.panel')).toBeNull();
    expect(root.querySelector('.panel')).not.toBeNull();

    document.documentElement.setAttribute('data-color-mode', 'light');
    await vi.waitFor(() => expect(host?.getAttribute('data-theme')).toBe('light'));
  });

  it('is read-only with a clear message on an unsupported layout', async () => {
    const { root } = await boot('<main>nothing</main>');
    expect(q(root, '.notice.warn')?.textContent).toContain('read-only');
    expect(q(root, '.filters')).toBeNull();
    expect(byText(root, 'button', 'Mark as viewed')).toBeUndefined();
  });
});

describe('filters, selection and tree', () => {
  const files = [
    f('src/Services/CustomerService.cs'),
    f('src/Services/Nested/OrderService.cs'),
    f('src/ServicesV2/Other.cs'),
    f('tests/CustomerServiceTests.cs'),
    f('README.md'),
  ];

  it('filters case-insensitively, shows N matching / M available and an empty state', async () => {
    const { root } = await mount(files);
    expect(q(root, '.counts')?.textContent).toBe('5 matching / 5 available');

    await type(q<HTMLInputElement>(root, 'input[type="search"]') as HTMLInputElement, 'CUSTOMER');
    expect(q(root, '.counts')?.textContent).toBe('2 matching / 5 available');
    expect(rowLabels(root).sort()).toEqual(['CustomerService.cs', 'CustomerServiceTests.cs']);

    await type(q<HTMLInputElement>(root, 'input[type="search"]') as HTMLInputElement, 'zzz');
    expect(q(root, '.empty')?.textContent).toContain('No files match');
  });

  it('combines search, extension and folder with AND, and Clear filters keeps the selection', async () => {
    const { root, controller: c } = await mount(files);
    await click(qa<HTMLInputElement>(root, 'li.file input[type="checkbox"]')[0]);
    const before = c.store.getState().selection.size;

    await type(q<HTMLInputElement>(root, 'input[type="search"]') as HTMLInputElement, 'service');
    await type(
      q<HTMLInputElement>(root, 'input[aria-label="Extensions"]') as HTMLInputElement,
      'cs',
    );
    await type(
      q<HTMLInputElement>(root, 'input[aria-label="Folder filter"]') as HTMLInputElement,
      'src/',
    );
    expect(q(root, '.counts')?.textContent).toBe('3 matching / 5 available');

    await click(byText(root, 'button', 'Clear filters'));
    expect(q(root, '.counts')?.textContent).toBe('5 matching / 5 available');
    expect(c.store.getState().selection.size).toBe(before);
  });

  it('shows folder checkboxes as indeterminate when partly selected, checked when full', async () => {
    const { root } = await mount(files);
    const folderBox = () =>
      qa<HTMLInputElement>(root, 'li.folder > .row input[type="checkbox"]').find((box) =>
        box.getAttribute('aria-label')?.includes('in src/Services,'),
      ) as HTMLInputElement;

    const nested = qa<HTMLInputElement>(root, 'li.file input[type="checkbox"]').find((box) =>
      box.getAttribute('aria-label')?.endsWith('CustomerService.cs'),
    );
    await click(nested);
    expect(folderBox().indeterminate).toBe(true);
    expect(folderBox().checked).toBe(false);

    await click(folderBox());
    expect(folderBox().indeterminate).toBe(false);
    expect(folderBox().checked).toBe(true);
    expect(q(root, '.selected')?.textContent).toBe('2 selected');
  });

  it('selects all matching and clears everything, including hidden selections', async () => {
    const { root } = await mount(files);
    await type(q<HTMLInputElement>(root, 'input[type="search"]') as HTMLInputElement, 'README');
    await click(byText(root, 'button', 'Select all matching'));
    expect(q(root, '.selected')?.textContent).toBe('1 selected');

    await type(q<HTMLInputElement>(root, 'input[type="search"]') as HTMLInputElement, 'Customer');
    expect(q(root, '.selected')?.textContent).toBe('1 selected');

    await click(byText(root, 'button', 'Clear selection'));
    expect(q(root, '.selected')?.textContent).toBe('0 selected');
  });

  it('labels every control and never relies on colour alone for state', async () => {
    const { root } = await mount([f('a.ts', true), f('b.ts', false)], ['c.ts']);
    for (const input of qa<HTMLInputElement>(root, 'input[type="checkbox"]')) {
      expect(input.getAttribute('aria-label'), input.outerHTML).toBeTruthy();
    }
    const badges = qa(root, '.badge').map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    expect(badges).toEqual(expect.arrayContaining(['✓ Viewed', '○ Unviewed', '– Not reachable']));
  });
});

describe('bulk actions in the panel', () => {
  it('disables the action buttons when there is nothing eligible', async () => {
    const { root } = await mount([f('a.ts'), f('b.ts', true)]);
    const markViewed = () => byText(root, 'button', /^Mark as viewed/);
    const markUnviewed = () => byText(root, 'button', /^Mark as unviewed/);
    expect(markViewed()?.disabled).toBe(true); // nothing selected

    await click(qa<HTMLInputElement>(root, 'li.file input[type="checkbox"]')[1]); // b.ts, already viewed
    expect(markViewed()?.disabled).toBe(true);
    expect(markUnviewed()?.disabled).toBe(false);
  });

  it('marks selected files through GitHub’s checkbox and shows the verified result', async () => {
    const { root } = await mount([f('a.ts'), f('b.ts'), f('c.ts')]);
    await click(qa<HTMLInputElement>(root, 'li.file input[type="checkbox"]')[0]);
    expect(byText(root, 'button', /^Mark as viewed/)?.textContent).toBe('Mark as viewed (1)');

    await click(byText(root, 'button', /^Mark as viewed/));
    await vi.waitFor(() => expect(q(root, '.result')).not.toBeNull());

    expect(q(root, '.result')?.textContent).toContain('Succeeded: 1');
    expect(q(root, '.result')?.textContent).toContain('Done. Every file was verified');
    const checked = qa<HTMLInputElement>(document, '.js-reviewed-checkbox').map(
      (box) => box.checked,
    );
    expect(checked).toEqual([true, false, false]);
    expect(qa(root, '.badge').map((b) => b.textContent?.includes('Viewed'))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('asks for confirmation on the Available scope, with an accessible dialog and Escape to cancel', async () => {
    const { root } = await mount([f('a.ts'), f('b.ts')]);
    await click(qa<HTMLInputElement>(root, 'input[name="difftick-scope"]')[2]);
    await click(byText(root, 'button', /^Mark as viewed/));

    const dialog = q(root, '[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('not necessarily the whole PR');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(
      qa(document, '.js-reviewed-checkbox').every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);

    await act(() => {
      dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(q(root, '[role="alertdialog"]')).toBeNull();
    expect(
      qa(document, '.js-reviewed-checkbox').every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);
  });

  it('folder quick actions confirm the scope and only touch that folder', async () => {
    const { root } = await mount([f('src/Domain/A.cs'), f('src/Infra/B.cs')]);
    await click(
      qa<HTMLButtonElement>(root, 'button.mini').find((b) =>
        b.getAttribute('aria-label')?.includes('Mark folder src/Domain as viewed'),
      ),
    );
    expect(q(root, '[role="alertdialog"]')?.textContent).toContain('src/Domain/');
    await click(byText(root, '[role="alertdialog"] button', 'Confirm'));
    await vi.waitFor(() => expect(q(root, '.result')).not.toBeNull());

    const state: Record<string, boolean | undefined> = {};
    for (const file of qa<HTMLElement>(document, '.file.js-file')) {
      state[file.getAttribute('data-tagsearch-path') ?? ''] =
        file.querySelector<HTMLInputElement>('.js-reviewed-checkbox')?.checked;
    }
    expect(state).toEqual({ 'src/Domain/A.cs': true, 'src/Infra/B.cs': false });
  });

  it('warns honestly when only some known files are reachable', async () => {
    const { root } = await mount([f('a.ts')], ['hidden1.ts', 'hidden2.ts']);
    expect(q(root, '.notices')?.textContent).toContain(
      '1 of 3 known files can be changed right now',
    );
  });

  it('explains the situation when no native Viewed control exists (e.g. signed out)', async () => {
    const { root } = await mount([f('a.ts', null), f('b.ts', null)]);
    expect(q(root, '.notices')?.textContent).toContain('No native "Viewed" controls were found');
    expect(q(root, '.notices')?.textContent).toContain('Sign in to GitHub');
    await click(qa<HTMLInputElement>(root, 'li.file input[type="checkbox"]')[0]);
    expect(byText(root, 'button', /^Mark as viewed/)?.disabled).toBe(true);
  });

  it('shows progress with a live region and a Cancel button while running', async () => {
    const { root } = await boot(
      classicPage(Array.from({ length: 8 }, (_, i) => ({ path: `f${i}.ts`, viewed: false }))),
      { itemDelayMs: 25 },
    );

    await click(byText(root, 'button', 'Select all matching'));
    await click(byText(root, 'button', /^Mark as viewed/));
    await vi.waitFor(() => expect(q(root, '.progress')).not.toBeNull());

    expect(q(root, '.progress progress')).not.toBeNull();
    expect(q(root, '.progress [role="status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(q(root, '.progress [role="status"]')?.textContent).toMatch(/Processing \d+ \/ 8/);
    const cancel = byText(root, '.progress button', 'Cancel');
    expect(cancel).toBeDefined();

    await click(cancel);
    await vi.waitFor(() => expect(q(root, '.result')).not.toBeNull());
    expect(q(root, '.result')?.textContent).toContain('Cancelled');
    expect(q(root, '.result')?.textContent).toContain('nothing was rolled back');
  });
});
