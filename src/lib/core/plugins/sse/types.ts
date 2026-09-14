import type { User } from '$lib/core/auth/types.js';

/** One event on the stream. */
export type SSEEvent = {
  /** `rime:lock`, or an app's own name. */
  event: string;
  payload: Record<string, any>;
};

/** Handles one event. Returning a promise is fine; nothing waits on it. */
export type SSEHandler = (event: SSEEvent) => void | Promise<void>;

/**
 * Whether this caller may listen to this key.
 *
 * Asked once per key when the connection opens, before anything is written to it — which is the
 * point of naming keys up front rather than filtering in the browser.
 */
export type SSEAccess = (key: string, user?: User) => boolean;
