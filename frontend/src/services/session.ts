type SessionExpiredHandler = () => void;

let handler: SessionExpiredHandler | null = null;

/**
 * Registers what to do when the API reports an expired session.
 *
 * The HTTP client is a plain module with no access to the router or to React
 * state, and importing the auth store here would close the cycle
 * `authStore -> services -> api -> authStore`. So the reaction is registered from
 * inside the tree instead — see `useSessionExpiry`.
 *
 * Returns the unsubscribe function, for the caller's effect cleanup.
 */
export function setSessionExpiredHandler(
  fn: SessionExpiredHandler,
): () => void {
  handler = fn;

  return () => {
    if (handler === fn) {
      handler = null;
    }
  };
}

export function notifySessionExpired(): void {
  handler?.();
}
