import { Lifecycle } from './lifecycle';

// Content script entry. It runs on github.com, does nothing off PR file routes, and never
// acts on its own: batch operations only start from an explicit click in the panel.
new Lifecycle().start();
