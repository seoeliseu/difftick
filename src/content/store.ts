export type Listener = () => void;

/** Minimal observable state container shared by the controller and the UI. */
export class Store<S> {
  private listeners = new Set<Listener>();

  constructor(private state: S) {}

  getState(): S {
    return this.state;
  }

  setState(patch: Partial<S> | ((state: S) => Partial<S>)): void {
    const change = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...change };
    for (const listener of [...this.listeners]) listener();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
