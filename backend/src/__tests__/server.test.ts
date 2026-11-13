import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listenMock = vi.hoisted(() => vi.fn());
vi.mock("@/app.js", () => ({ app: { listen: listenMock } }));

describe("server.ts process handlers", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  const processOnSpy = vi.spyOn(process, "on");

  beforeEach(() => {
    vi.resetModules();
    errorSpy.mockClear();
    exitSpy.mockClear();
    processOnSpy.mockClear();
  });

  afterEach(() => {
    for (const [event, listener] of processOnSpy.mock.calls) {
      process.removeListener(event, listener as (...args: unknown[]) => void);
    }
  });

  it("logs unhandledRejection with console.error without exiting", async () => {
    await import("@/server.js");
    const call = processOnSpy.mock.calls.find(
      ([event]) => event === "unhandledRejection",
    );
    expect(call).toBeDefined();
    const handler = call?.[1] as (
      reason: unknown,
      promise: Promise<unknown>,
    ) => void;

    const err = new Error("unhandled promise error");
    handler(err, Promise.resolve());

    expect(errorSpy).toHaveBeenCalledWith(
      "[Process] Unhandled Rejection:",
      err.stack,
    );
    expect(exitSpy).not.toHaveBeenCalled();

    errorSpy.mockClear();
    handler("raw rejection reason", Promise.resolve());
    expect(errorSpy).toHaveBeenCalledWith(
      "[Process] Unhandled Rejection:",
      "raw rejection reason",
    );
  });

  it("logs uncaughtException with console.error and exits with code 1", async () => {
    await import("@/server.js");
    const call = processOnSpy.mock.calls.find(
      ([event]) => event === "uncaughtException",
    );
    expect(call).toBeDefined();
    const handler = call?.[1] as (err: unknown) => void;

    const err = new Error("fatal crash");
    handler(err);

    expect(errorSpy).toHaveBeenCalledWith(
      "[Process] Uncaught Exception:",
      err.stack,
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    errorSpy.mockClear();
    exitSpy.mockClear();
    handler("fatal raw crash");
    expect(errorSpy).toHaveBeenCalledWith(
      "[Process] Uncaught Exception:",
      "fatal raw crash",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
