import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useActionRegisterStore } from "@/stores/actionRegisterStore";
import { resetAuthStore } from "./auth";
import { resetFactoryCounter } from "./factories";
import { server } from "./http";

beforeAll(() => {
  // jsdom has no matchMedia, and the home header listens to it to close the
  // mobile menu when the viewport widens.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // "error" rather than "warn": a request with no handler fails the test
  // loudly instead of hanging until timeout against a real host.
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  // Explicit because `globals: false` means there is no global afterEach for
  // React Testing Library to hook its automatic cleanup onto. Without this,
  // each test renders on top of the previous test's DOM.
  cleanup();

  server.resetHandlers();

  // The auth store is a module singleton persisted to localStorage, so both
  // halves have to be cleared or state leaks into the next test.
  resetAuthStore();

  // Module singleton too: a test that opens the modal or registers a success
  // callback would otherwise hand both to the next test.
  useActionRegisterStore.setState({
    isOpen: false,
    onSuccessCallback: undefined,
  });

  resetFactoryCounter();
});

afterAll(() => {
  server.close();
});
