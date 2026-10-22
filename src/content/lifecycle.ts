import { parsePrRoute } from '../github/route';
import { mountPanel, type MountedPanel } from '../ui/mount';
import { ReviewController } from './controller';

const INSTANCE_ATTRIBUTE = 'data-difftick-instance';
/** Events GitHub (Turbo, pjax, soft navigation) and the browser emit around in-page navigation. */
const DOCUMENT_EVENTS = ['turbo:load', 'turbo:render', 'pjax:end', 'soft-nav:end'];
const POLL_MS = 1000;

interface Session {
  key: string;
  controller: ReviewController;
  panel: MountedPanel;
}

/**
 * Mounts the panel while the tab shows a PR's files and tears it down otherwise.
 * GitHub navigates without page loads, so it listens for its navigation events and
 * double-checks the URL on a slow timer.
 */
export class Lifecycle {
  private session: Session | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly listeners: Array<() => void> = [];
  private readonly token = Math.random().toString(36).slice(2);
  private stopped = false;

  constructor(private readonly win: Window = window) {}

  private get doc(): Document {
    return this.win.document;
  }

  start(): void {
    // A newer content-script instance (e.g. after an extension reload) takes over.
    this.doc.documentElement.setAttribute(INSTANCE_ATTRIBUTE, this.token);

    const sync = () => this.sync();
    for (const name of DOCUMENT_EVENTS) {
      this.doc.addEventListener(name, sync);
      this.listeners.push(() => this.doc.removeEventListener(name, sync));
    }
    this.win.addEventListener('popstate', sync);
    this.listeners.push(() => this.win.removeEventListener('popstate', sync));

    const navigation = (this.win as Window & { navigation?: EventTarget }).navigation;
    navigation?.addEventListener('navigatesuccess', sync);
    this.listeners.push(() => navigation?.removeEventListener('navigatesuccess', sync));

    this.timer = setInterval(sync, POLL_MS);
    this.sync();
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.timer);
    for (const remove of this.listeners.splice(0)) remove();
    this.teardown();
  }

  /** Reconciles the mounted panel with the current URL. Safe to call at any time. */
  sync(): void {
    if (this.stopped) return;
    if (this.doc.documentElement.getAttribute(INSTANCE_ATTRIBUTE) !== this.token) {
      this.stop();
      return;
    }

    const { hostname, pathname } = this.win.location;
    const route = parsePrRoute(hostname, pathname);

    if (!route) {
      this.teardown();
      return;
    }
    if (this.session?.key === route.key) {
      this.session.panel.ensureAttached();
      return;
    }

    this.teardown();
    if (!this.doc.body) return;
    const controller = new ReviewController({ document: this.doc });
    const panel = mountPanel(this.doc, controller);
    controller.start();
    this.session = { key: route.key, controller, panel };
  }

  private teardown(): void {
    const session = this.session;
    if (!session) return;
    this.session = null;
    // Dispose first: it aborts any running batch before anything else can happen.
    session.controller.dispose();
    session.panel.unmount();
  }
}
