import { setContext } from 'svelte';

function createStore<T>(initial: T) {
  let value = $state(initial);
  return {
    get value() {
      return value;
    },
    set value(v: T) {
      value = v;
    }
  };
}

/** A `{ value }` store set as context under `name`: the document title (title.ts) uses it. */
function createContext<T>(name: string, initial: T) {
  const store = createStore(initial);
  setContext(name, store);
  return store;
}

export default createContext;
