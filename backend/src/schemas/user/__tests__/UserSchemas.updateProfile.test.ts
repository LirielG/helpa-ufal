import { describe, expect, it } from "vitest";
import { updateProfileSchemaFor } from "@/schemas/user/UserSchemas.js";

const IMMUTABLE = "This field cannot be updated.";
const EMPTY_BODY = "At least one updatable field must be provided.";
const CURRENT_REQUIRED = "Current password is required to set a new password.";
const POLICY_MESSAGE =
  "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.";

const VALID_NEW_PASSWORD = "Nova@1234";
const CURRENT_PASSWORD = "Senha@123";

type UserType = "STUDENT" | "TEACHER";

function parse(userType: UserType, input: unknown) {
  return updateProfileSchemaFor(userType).safeParse(input);
}

function toErrors(result: ReturnType<typeof parse>) {
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

const IMMUTABLE_KEYS: Array<[string, unknown]> = [
  ["email", "novo@ufal.br"],
  ["userType", "TEACHER"],
  ["isManager", true],
  ["registrationCode", "999999"],
  ["cndb", "CNDB-0001"],
  ["id", "7c9e6679-7425-40de-944b-e07fc1f90ae7"],
  ["createdAt", "2020-01-01T00:00:00.000Z"],
];

describe.each<UserType>(["STUDENT", "TEACHER"])(
  "updateProfileSchemaFor(%s) — rules shared by both profiles",
  (userType) => {
    it("accepts fullName alone", () => {
      const result = parse(userType, { fullName: "Maria Silva Souza" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ fullName: "Maria Silva Souza" });
    });

    it("trims fullName", () => {
      const result = parse(userType, { fullName: "  Maria Silva  " });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ fullName: "Maria Silva" });
    });

    it.each([
      ["empty", ""],
      ["only spaces", "   "],
      ["not a string", 123],
      ["null", null],
    ])("rejects a fullName that is %s", (_label, fullName) => {
      const errors = toErrors(parse(userType, { fullName }));

      expect(errors).toEqual([
        expect.objectContaining({ field: "fullName" }),
      ]);
    });

    it("has no maximum length for fullName (same as registration)", () => {
      const result = parse(userType, { fullName: "A".repeat(500) });

      expect(result.success).toBe(true);
    });

    it("accepts a password change with the current password", () => {
      const result = parse(userType, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: VALID_NEW_PASSWORD,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        currentPassword: CURRENT_PASSWORD,
        newPassword: VALID_NEW_PASSWORD,
      });
    });

    it("accepts fullName and a password change in the same request", () => {
      const result = parse(userType, {
        fullName: "Maria",
        currentPassword: CURRENT_PASSWORD,
        newPassword: VALID_NEW_PASSWORD,
      });

      expect(result.success).toBe(true);
    });

    it("does not apply the password policy to currentPassword", () => {
      // An old account may predate the policy; only the stored hash decides.
      const result = parse(userType, {
        currentPassword: "abc",
        newPassword: VALID_NEW_PASSWORD,
      });

      expect(result.success).toBe(true);
    });

    it.each([
      ["too short", "Ab1!"],
      ["without an uppercase letter", "senha@1234"],
      ["without a lowercase letter", "SENHA@1234"],
      ["without a number", "Senha@abcd"],
      ["without a special character", "Senha12345"],
      ["with a non-ASCII character", "Senha@12é4"],
    ])("rejects a newPassword %s with the registration message", (_l, newPassword) => {
      const errors = toErrors(
        parse(userType, { currentPassword: CURRENT_PASSWORD, newPassword }),
      );

      expect(errors).toEqual([
        { field: "newPassword", message: POLICY_MESSAGE },
      ]);
    });

    it("requires currentPassword when newPassword is present", () => {
      const errors = toErrors(
        parse(userType, { newPassword: VALID_NEW_PASSWORD }),
      );

      expect(errors).toEqual([
        { field: "currentPassword", message: CURRENT_REQUIRED },
      ]);
    });

    it("rejects an empty currentPassword when newPassword is present", () => {
      const errors = toErrors(
        parse(userType, {
          currentPassword: "",
          newPassword: VALID_NEW_PASSWORD,
        }),
      );

      expect(errors).toEqual([
        expect.objectContaining({ field: "currentPassword" }),
      ]);
    });

    it.each([
      ["an empty object", {}],
      ["only currentPassword", { currentPassword: CURRENT_PASSWORD }],
    ])("rejects %s with the body error", (_label, input) => {
      const errors = toErrors(parse(userType, input));

      expect(errors).toEqual([{ field: "body", message: EMPTY_BODY }]);
    });

    it.each([
      ["an array", []],
      ["a string", "fullName"],
      ["null", null],
    ])("rejects %s as the whole body", (_label, input) => {
      expect(parse(userType, input).success).toBe(false);
    });

    it.each(IMMUTABLE_KEYS)(
      "rejects %s next to a valid fullName, reporting only that key",
      (key, value) => {
        const errors = toErrors(
          parse(userType, { fullName: "Should Not Apply", [key]: value }),
        );

        expect(errors).toEqual([{ field: key, message: IMMUTABLE }]);
      },
    );

    it.each(IMMUTABLE_KEYS)("rejects %s sent alone", (key, value) => {
      const errors = toErrors(parse(userType, { [key]: value }));

      expect(errors).toEqual(
        expect.arrayContaining([{ field: key, message: IMMUTABLE }]),
      );
    });

    it("rejects an unknown key like any other key outside the whitelist", () => {
      const errors = toErrors(
        parse(userType, { fullName: "Maria", surprise: 1 }),
      );

      expect(errors).toEqual([{ field: "surprise", message: IMMUTABLE }]);
    });

    it("reports every offending key, not just the first (fail-collect)", () => {
      const errors = toErrors(
        parse(userType, {
          fullName: "Maria",
          isManager: true,
          email: "x@ufal.br",
          userType: "TEACHER",
        }),
      );

      expect(errors).toHaveLength(3);
      expect(errors).toEqual(
        expect.arrayContaining([
          { field: "isManager", message: IMMUTABLE },
          { field: "email", message: IMMUTABLE },
          { field: "userType", message: IMMUTABLE },
        ]),
      );
    });
  },
);

describe("updateProfileSchemaFor(STUDENT) — course", () => {
  it.each([
    ["a new value", "Engenharia de Computação"],
    ["null", null],
    ["an empty string", ""],
  ])("rejects course sent as %s", (_label, course) => {
    const errors = toErrors(parse("STUDENT", { fullName: "Maria", course }));

    expect(errors).toEqual([{ field: "course", message: IMMUTABLE }]);
  });

  it("rejects course sent alone", () => {
    const errors = toErrors(parse("STUDENT", { course: "Engenharia" }));

    expect(errors).toEqual(
      expect.arrayContaining([{ field: "course", message: IMMUTABLE }]),
    );
  });
});

describe("updateProfileSchemaFor(TEACHER) — course", () => {
  it("accepts a course string", () => {
    const result = parse("TEACHER", { course: "Engenharia de Computação" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ course: "Engenharia de Computação" });
  });

  it("trims the course", () => {
    const result = parse("TEACHER", { course: "  Engenharia  " });

    expect(result.data).toEqual({ course: "Engenharia" });
  });

  it("accepts null to clear the course, and null counts as an updatable field", () => {
    const result = parse("TEACHER", { course: null });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ course: null });
  });

  it.each([
    ["an empty string", ""],
    ["only spaces", "   "],
    ["a number", 42],
  ])("rejects a course that is %s", (_label, course) => {
    const errors = toErrors(parse("TEACHER", { course }));

    expect(errors).toEqual([expect.objectContaining({ field: "course" })]);
  });

  it("accepts course together with fullName and a password change", () => {
    const result = parse("TEACHER", {
      fullName: "Ricardo",
      course: null,
      currentPassword: CURRENT_PASSWORD,
      newPassword: VALID_NEW_PASSWORD,
    });

    expect(result.success).toBe(true);
  });
});
