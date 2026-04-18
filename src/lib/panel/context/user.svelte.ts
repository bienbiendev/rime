import type { User } from '$lib/core/collections/auth/types.js';
import { getContext, setContext } from 'svelte';

function createUserStore(initial: User) {
  const user = $state.raw(initial);

  return {
    get attributes() {
      return user;
    }
  };
}

export const USER_CTX = Symbol('rime.user');

export function setUserContext(initial: User) {
  const user = createUserStore(initial);
  return setContext(USER_CTX, user);
}

export function getUserContext() {
  return getContext<ReturnType<typeof setUserContext>>(USER_CTX);
}
