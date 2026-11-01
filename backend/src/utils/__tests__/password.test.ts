import { describe, expect, it } from "vitest";
import {
  isPasswordValid,
  validatePassword,
  type PasswordRule,
  type PasswordValidationResult,
} from "@/utils/password.js";

const ALL_VALID: PasswordValidationResult = {
  minLength: true,
  uppercaseLetter: true,
  lowercaseLetter: true,
  number: true,
  special: true,
  onlyValidCharacters: true,
};

const CASES_FAILING_ONE_RULE: Array<[PasswordRule, string]> = [
  ["minLength", "Abcde1!"],
  ["uppercaseLetter", "abcdef1!"],
  ["lowercaseLetter", "ABCDEF1!"],
  ["number", "Abcdefg!"],
  ["special", "Abcdef12"],
  ["onlyValidCharacters", "Abcdef1!é"],
];

describe("validatePassword", () => {
  it("marks every rule true when all rules are met", () => {
    expect(validatePassword("Abcdef1!")).toEqual(ALL_VALID);
  });

  it.each(CASES_FAILING_ONE_RULE)(
    "marks only %s as false when only that rule fails",
    (failedRule, password) => {
      expect(validatePassword(password)).toEqual({
        ...ALL_VALID,
        [failedRule]: false,
      });
    },
  );
});

describe("isPasswordValid", () => {
  it("returns true when all rules are met", () => {
    expect(isPasswordValid("Abcdef1!")).toBe(true);
  });

  it.each(CASES_FAILING_ONE_RULE)(
    "returns false when %s fails",
    (_failedRule, password) => {
      expect(isPasswordValid(password)).toBe(false);
    },
  );
});
