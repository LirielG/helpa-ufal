import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types";
import { makeUser } from "./factories";

/**
 * Puts a signed-in user into the auth store and returns it, so assertions can
 * reference the same object. `setup.ts` resets the store after every test, so this never leaks.
 */
export function signIn(overrides: Partial<User> = {}): User {
  const user = makeUser(overrides);
  useAuthStore.getState().setUser(user);
  return user;
}

/** Explicit sign-out, for tests that assert on the logged-out branch. */
export function signOut(): void {
  useAuthStore.getState().setUser(null);
}

/**
 * Restores the store to its initial state and clears the persisted copy.
 * Called automatically by setup.ts after each test.
 */
export function resetAuthStore(): void {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  localStorage.clear();
}
