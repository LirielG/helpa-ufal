import { describe, it, expect } from "vitest";
import { renderHook, act } from "@/test";
import { makeUser, signOut } from "@/test";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";

describe("useAuth", () => {
  it("isAuthenticated follows the store user: false without a user, true after setUser", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);

    act(() => useAuthStore.getState().setUser(makeUser()));

    expect(result.current.isAuthenticated).toBe(true);
  });

  it("returns the store actions — calling logout through the hook clears the store user", async () => {
    signOut();
    useAuthStore.getState().setUser(makeUser());
    const { result } = renderHook(() => useAuth());

    await act(async () => result.current.logout());

    expect(useAuthStore.getState().user).toBeNull();
  });
});