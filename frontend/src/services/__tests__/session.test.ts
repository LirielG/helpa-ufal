import { afterEach, describe, expect, it, vi } from "vitest";
import { notifySessionExpired, setSessionExpiredHandler } from "../session";

afterEach(() => {
  // The handler is module state and nothing else resets it: register a noop
  // and immediately unsubscribe it so the module goes back to having none.
  setSessionExpiredHandler(() => {})();
});

describe("setSessionExpiredHandler", () => {
  it("calls the registered handler on notify", () => {
    const handler = vi.fn();

    setSessionExpiredHandler(handler);
    notifySessionExpired();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("replaces the previous handler when a second one registers", () => {
    const previous = vi.fn();
    const current = vi.fn();

    setSessionExpiredHandler(previous);
    setSessionExpiredHandler(current);
    notifySessionExpired();

    expect(previous).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
  });

  it("ignores the unsubscribe of a handler that was already replaced", () => {
    const previous = vi.fn();
    const current = vi.fn();

    const unsubscribePrevious = setSessionExpiredHandler(previous);
    setSessionExpiredHandler(current);
    unsubscribePrevious();
    notifySessionExpired();

    expect(current).toHaveBeenCalledTimes(1);
    expect(previous).not.toHaveBeenCalled();
  });

  it("stops notifying after the current handler unsubscribes", () => {
    const handler = vi.fn();

    setSessionExpiredHandler(handler)();

    expect(() => notifySessionExpired()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
