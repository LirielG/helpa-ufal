import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import AuthMiddleware from "../AuthMiddleware.js";
import CustomError from "@/models/error/CustomError.js";
import { signJwt } from "@/utils/jwt.js";
import type { AuthenticatedUser } from "@/types/auth.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const MALFORMED_TOKEN = "this-is-not-a-jwt";
const RES = {} as Response;

function anAuthenticatedUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: USER_ID,
    userType: "STUDENT",
    isManager: false,
    tokenVersion: 0,
    ...overrides,
  };
}

/** Token issued before the tokenVersion claim existed. */
function aTokenWithoutVersion(): string {
  const { tokenVersion: _omitted, ...claims } = anAuthenticatedUser();
  return jwt.sign(claims, process.env.JWT_SECRET!);
}

function mockRepository(stored: Partial<AuthenticatedUser> | null = {}) {
  return {
    findSessionById: vi
      .fn()
      .mockResolvedValue(
        stored === null ? null : { ...anAuthenticatedUser(), ...stored },
      ),
  } as unknown as IUserRepository & {
    findSessionById: ReturnType<typeof vi.fn>;
  };
}

function anExpiredToken(
  payload: AuthenticatedUser = anAuthenticatedUser(),
): string {
  return signJwt(payload, "-1s");
}

function aTokenWithInvalidSignature(
  payload: AuthenticatedUser = anAuthenticatedUser(),
): string {
  return jwt.sign(payload, "wrong-secret");
}

function mockRequest(
  options: {
    cookieToken?: string;
    rawAuthorization?: string;
  } = {},
): Request {
  const headers: Record<string, string> = {};
  if (options.rawAuthorization)
    headers.authorization = options.rawAuthorization;

  const cookies: Record<string, string> = {};
  if (options.cookieToken) cookies.token = options.cookieToken;

  return { headers, cookies } as unknown as Request;
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

async function expectAuthError(
  fn: () => unknown,
  status: number,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CustomError);
    expect((error as CustomError & { statusCode: number }).statusCode).toBe(
      status,
    );
    return;
  }
  throw new Error(
    `Expected a CustomError with status ${status}, but nothing was thrown.`,
  );
}

describe("AuthMiddleware", () => {
  const middleware = new AuthMiddleware({ userRepository: mockRepository() });

  describe("required authentication — auth({ userTypes: 'all' })", () => {
    it("throws 401 and does not call next when no token is provided", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest();
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects a valid token sent only in the authorization header", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({
        rawAuthorization: `${["Bear", "er"].join("")} ${signJwt(anAuthenticatedUser())}`,
      });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("calls next and populates req.user with a valid cookie token", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const user = anAuthenticatedUser();
      const req = mockRequest({ cookieToken: signJwt(user) });
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toMatchObject({
        id: user.id,
        userType: "STUDENT",
        isManager: false,
      });
    });

    it("throws 401 for a malformed token", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ cookieToken: MALFORMED_TOKEN });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("throws 401 for a token with an invalid signature", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ cookieToken: aTokenWithInvalidSignature() });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("throws 401 for an expired token", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ cookieToken: anExpiredToken() });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("throws 401 when the authorization header contains an unprefixed token", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({
        rawAuthorization: signJwt(anAuthenticatedUser()),
      });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
    });

    it("clears a pre-existing req.user when validation fails", async () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ cookieToken: MALFORMED_TOKEN });
      req.user = anAuthenticatedUser({ id: "pre-existing-user" });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("optional authentication — auth()", () => {
    it("calls next anonymously when no token is provided", async () => {
      const handler = middleware.auth();
      const req = mockRequest();
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });

    it("calls next and populates req.user with a valid token", async () => {
      const handler = middleware.auth();
      const user = anAuthenticatedUser();
      const req = mockRequest({ cookieToken: signJwt(user) });
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toMatchObject({
        id: user.id,
        userType: "STUDENT",
        isManager: false,
      });
    });

    it.each([
      ["invalid", MALFORMED_TOKEN],
      ["expired", anExpiredToken()],
    ])(
      "ignores an %s token and proceeds anonymously",
      async (_label, token) => {
        const handler = middleware.auth();
        const req = mockRequest({ cookieToken: token });
        const next = mockNext();

        await handler(req, RES, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
        expect(req.user).toBeUndefined();
      },
    );
  });

  it("uses current roles from the database instead of token claims", async () => {
    const stored = anAuthenticatedUser({
      userType: "TEACHER",
      isManager: true,
    });
    const handler = new AuthMiddleware({
      userRepository: mockRepository(stored),
    }).auth({ manager: true, userTypes: ["TEACHER"] });
    const req = mockRequest({ cookieToken: signJwt(anAuthenticatedUser()) });
    const next = mockNext();

    await handler(req, RES, next);

    expect(next).toHaveBeenCalledExactlyOnceWith();
    expect(req.user).toEqual(stored);
  });

  describe("authorization", () => {
    it.each(["STUDENT", "TEACHER"] as const)(
      'userTypes "all" allows %s',
      async (userType) => {
        const handler = middleware.auth({ userTypes: "all" });
        const req = mockRequest({
          cookieToken: signJwt(anAuthenticatedUser({ userType })),
        });
        const next = mockNext();

        await handler(req, RES, next);

        expect(next).toHaveBeenCalledTimes(1);
      },
    );

    it("calls next when the userType is explicitly allowed", async () => {
      const handler = new AuthMiddleware({
        userRepository: mockRepository({ userType: "TEACHER" }),
      }).auth({ userTypes: ["TEACHER"] });
      const req = mockRequest({
        cookieToken: signJwt(anAuthenticatedUser({ userType: "TEACHER" })),
      });
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("throws 403 when the userType is not allowed", async () => {
      const handler = middleware.auth({ userTypes: ["TEACHER"] });
      const req = mockRequest({
        cookieToken: signJwt(anAuthenticatedUser({ userType: "STUDENT" })),
      });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 403);
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next for a manager when manager: true", async () => {
      const handler = new AuthMiddleware({
        userRepository: mockRepository({ isManager: true }),
      }).auth({ manager: true });
      const req = mockRequest({
        cookieToken: signJwt(anAuthenticatedUser({ isManager: true })),
      });
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it("throws 403 for a non-manager when manager: true", async () => {
      const handler = middleware.auth({ manager: true });
      const req = mockRequest({
        cookieToken: signJwt(anAuthenticatedUser({ isManager: false })),
      });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 403);
      expect(next).not.toHaveBeenCalled();
    });

    it("does not let a manager bypass userTypes restrictions", async () => {
      const handler = middleware.auth({ userTypes: ["TEACHER"] });
      const req = mockRequest({
        cookieToken: signJwt(
          anAuthenticatedUser({ userType: "STUDENT", isManager: true }),
        ),
      });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("token version", () => {
    it("calls next when the token version matches the stored one", async () => {
      const userRepository = mockRepository({ tokenVersion: 3 });
      const handler = new AuthMiddleware({ userRepository }).auth({
        userTypes: "all",
      });
      const req = mockRequest({
        cookieToken: signJwt(anAuthenticatedUser({ tokenVersion: 3 })),
      });
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({ id: USER_ID, tokenVersion: 3 });
      expect(userRepository.findSessionById).toHaveBeenCalledWith(USER_ID);
    });

    it("throws 401 when the stored version moved past the token's", async () => {
      const userRepository = mockRepository({ tokenVersion: 1 });
      const handler = new AuthMiddleware({ userRepository }).auth({
        userTypes: "all",
      });
      const req = mockRequest({
        cookieToken: signJwt(anAuthenticatedUser({ tokenVersion: 0 })),
      });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it.each([{ userTypes: "all" as const }, {}])(
      "rejects a revoked session with SESSION_INVALID for %j",
      async (options) => {
        const handler = new AuthMiddleware({
          userRepository: mockRepository({ tokenVersion: 1 }),
        }).auth(options);
        const req = mockRequest({
          cookieToken: signJwt(anAuthenticatedUser()),
        });
        const next = mockNext();

        await expect(handler(req, RES, next)).rejects.toMatchObject({
          statusCode: 401,
          code: "SESSION_INVALID",
        });
        expect(next).not.toHaveBeenCalled();
        expect(req.user).toBeUndefined();
      },
    );

    it("treats a token without the claim as version 0", async () => {
      const handler = new AuthMiddleware({
        userRepository: mockRepository({ tokenVersion: 0 }),
      }).auth({ userTypes: "all" });
      const req = mockRequest({ cookieToken: aTokenWithoutVersion() });
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toMatchObject({ id: USER_ID, tokenVersion: 0 });
    });

    it("throws 401 for a token without the claim once the user is past version 0", async () => {
      const handler = new AuthMiddleware({
        userRepository: mockRepository({ tokenVersion: 1 }),
      }).auth({ userTypes: "all" });
      const req = mockRequest({ cookieToken: aTokenWithoutVersion() });
      const next = mockNext();

      await expectAuthError(() => handler(req, RES, next), 401);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects a removed user with SESSION_INVALID", async () => {
      const handler = new AuthMiddleware({
        userRepository: mockRepository(null),
      }).auth({ userTypes: "all" });
      const req = mockRequest({ cookieToken: signJwt(anAuthenticatedUser()) });
      const next = mockNext();

      await expect(handler(req, RES, next)).rejects.toMatchObject({
        statusCode: 401,
        code: "SESSION_INVALID",
      });
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it.each([
      ["no token", undefined],
      ["an invalid token", MALFORMED_TOKEN],
    ])(
      "does not query the database when there is %s",
      async (_label, token) => {
        const userRepository = mockRepository();
        const handler = new AuthMiddleware({ userRepository }).auth();
        const req = mockRequest({ cookieToken: token });

        await handler(req, RES, mockNext());

        expect(userRepository.findSessionById).not.toHaveBeenCalled();
      },
    );

    it("proceeds anonymously on optional auth when the version lookup fails", async () => {
      const userRepository = mockRepository();
      userRepository.findSessionById.mockRejectedValue(
        new Error("connection lost"),
      );
      const handler = new AuthMiddleware({ userRepository }).auth();
      const req = mockRequest({ cookieToken: signJwt(anAuthenticatedUser()) });
      const next = mockNext();

      await handler(req, RES, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });

    it("propagates a failed version lookup on required auth instead of answering 401", async () => {
      const failure = new Error("connection lost");
      const userRepository = mockRepository();
      userRepository.findSessionById.mockRejectedValue(failure);
      const handler = new AuthMiddleware({ userRepository }).auth({
        userTypes: "all",
      });
      const req = mockRequest({ cookieToken: signJwt(anAuthenticatedUser()) });
      const next = mockNext();

      await expect(handler(req, RES, next)).rejects.toBe(failure);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
});
