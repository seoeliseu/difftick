import { ReviewController } from '../src/content/controller';
import { mountPanel } from '../src/ui/mount';
import { classicPage, installGithubBehaviour, type FixtureFile } from '../src/test/builders';

// Manual-testing harness: mounts the real panel against a fake classic Files changed page.
// It exercises the UI and the controller; it says nothing about live GitHub compatibility.
const params = new URLSearchParams(location.search);
const total = Number(params.get('files') ?? 60);
const hidden = Number(params.get('hidden') ?? 6);

if (params.get('theme') === 'dark')
  document.documentElement.setAttribute('data-color-mode', 'dark');

const folders = [
  'src/Services',
  'src/Services/Nested',
  'src/ServicesV2',
  'src/Domain',
  'tests',
  'docs',
];
const extensions = ['cs', 'cs', 'cs', 'ts', 'json', 'md'];
const files: FixtureFile[] = Array.from({ length: total }, (_, i) => ({
  path: `${folders[i % folders.length]}/File${String(i).padStart(3, '0')}.${extensions[i % extensions.length]}`,
  viewed: i % 7 === 0,
}));
files.push({ path: 'README.md', viewed: false }, { path: '.gitignore', viewed: true });
const treeOnly = Array.from({ length: hidden }, (_, i) => `src/Lazy/NotRendered${i}.cs`);

const page = document.getElementById('page');
if (page) {
  page.innerHTML = classicPage(files, treeOnly);
  for (const file of page.querySelectorAll('.file')) file.classList.add('file');
}

if (params.get('flaky')) {
  installGithubBehaviour(document.body, {
    revert: (path) => path.endsWith('3.cs') || path.endsWith('9.ts'),
    delayMs: 30,
  });
}

const controller = new ReviewController({ document });
mountPanel(document, controller);
controller.start();
controller.setOpen(true);
