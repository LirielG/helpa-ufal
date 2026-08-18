import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { resetAuthStore } from "./auth";
import { resetFactoryCounter } from "./factories";
import { server } from "./http";

beforeAll(() => {
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

  resetFactoryCounter();
});

afterAll(() => {
  server.close();
});
