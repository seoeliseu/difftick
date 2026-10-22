import { useEffect, useState } from 'preact/hooks';
import type { Store } from '../content/store';

/** Subscribes a component to a store and re-renders on every change. */
export function useStore<S>(store: Store<S>): S {
  const [state, setState] = useState(store.getState());
  useEffect(() => {
    setState(store.getState());
    return store.subscribe(() => setState(store.getState()));
  }, [store]);
  return state;
}
