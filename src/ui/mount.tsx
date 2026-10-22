import { render } from 'preact';
import type { ReviewController } from '../content/controller';
import { Panel } from './panel';
import styles from './styles.css?inline';

export const HOST_ATTRIBUTE = 'data-difftick-root';

export interface MountedPanel {
  host: HTMLElement;
  /** Re-attach the host if the page replaced <body> (Turbo navigations do this). */
  ensureAttached(): void;
  unmount(): void;
}

export function resolveTheme(doc: Document): 'light' | 'dark' {
  const mode = doc.documentElement.getAttribute('data-color-mode');
  if (mode === 'dark' || mode === 'light') return mode;
  return doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyStyles(root: ShadowRoot, doc: Document): void {
  const view = doc.defaultView;
  // Constructable stylesheets avoid any dependence on the page's style-src CSP.
  if (view && 'adoptedStyleSheets' in root && typeof view.CSSStyleSheet === 'function') {
    try {
      const sheet = new view.CSSStyleSheet();
      sheet.replaceSync(styles);
      root.adoptedStyleSheets = [sheet];
      return;
    } catch {
      /* fall through to a <style> element */
    }
  }
  const style = doc.createElement('style');
  style.textContent = styles;
  root.append(style);
}

/** Mounts exactly one panel: any host left by an earlier instance is removed first. */
export function mountPanel(doc: Document, controller: ReviewController): MountedPanel {
  for (const stale of doc.querySelectorAll(`[${HOST_ATTRIBUTE}]`)) stale.remove();

  const host = doc.createElement('div');
  host.setAttribute(HOST_ATTRIBUTE, '');
  const root = host.attachShadow({ mode: 'open' });
  applyStyles(root, doc);
  const container = doc.createElement('div');
  root.append(container);

  const syncTheme = () => host.setAttribute('data-theme', resolveTheme(doc));
  syncTheme();
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ['data-color-mode', 'data-light-theme', 'data-dark-theme'],
  });
  const media = doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', syncTheme);

  doc.body.append(host);
  render(<Panel controller={controller} />, container);

  return {
    host,
    ensureAttached() {
      if (!host.isConnected) doc.body.append(host);
    },
    unmount() {
      render(null, container);
      themeObserver.disconnect();
      media?.removeEventListener?.('change', syncTheme);
      host.remove();
    },
  };
}
