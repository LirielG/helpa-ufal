import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { uniqueViolationFields } from "@/utils/prismaErrors.js";

function knownError(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("", {
    code,
    clientVersion: "test",
    meta,
  });
}

describe("uniqueViolationFields", () => {
  it("reads the quoted fields reported by the pg driver adapter, unquoted", () => {
    const error = knownError("P2002", {
      driverAdapterError: {
        cause: { constraint: { fields: ['"validationCode"'] } },
      },
    });

    expect(uniqueViolationFields(error)).toEqual(["validationCode"]);
  });

  it("reads the legacy meta.target, as an array or a single name", () => {
    expect(
      uniqueViolationFields(knownError("P2002", { target: ["email"] })),
    ).toEqual(["email"]);
    expect(
      uniqueViolationFields(knownError("P2002", { target: "email" })),
    ).toEqual(["email"]);
  });

  it("returns null for anything that is not a P2002", () => {
    expect(uniqueViolationFields(knownError("P2025", {}))).toBeNull();
    expect(uniqueViolationFields(new Error("boom"))).toBeNull();
  });
});
