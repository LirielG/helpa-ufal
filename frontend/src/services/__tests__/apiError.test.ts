import { describe, expect, it } from "vitest";
import { ApiError, isConnectionFailure } from "../apiError";

describe("isConnectionFailure", () => {
  it.each([0, 500, 503, 599])(
    "recognizes status %i as a connection failure",
    (status) => {
      expect(isConnectionFailure(new ApiError(status, "Any API message"))).toBe(
        true,
      );
    },
  );

  it.each([200, 400, 401, 403, 404, 409, 499, 600])(
    "does not classify status %i as a connection failure",
    (status) => {
      expect(isConnectionFailure(new ApiError(status, "Any API message"))).toBe(
        false,
      );
    },
  );

  it.each([new Error("Network failed"), { status: 0 }, null, undefined])(
    "does not classify an unrelated error as a connection failure",
    (error) => {
      expect(isConnectionFailure(error)).toBe(false);
    },
  );
});
