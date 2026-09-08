import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import AuthMiddleware from "../AuthMiddleware.js";
import CustomError from "@/models/error/CustomError.js";
import { signJwt } from "@/utils/jwt.js";
import type { AuthenticatedUser } from "@/types/auth.js";


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
    ...overrides,
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
    bearerToken?: string;
    cookieToken?: string;
    rawAuthorization?: string;
  } = {},
): Request {
  const headers: Record<string, string> = {};
  if (options.bearerToken) headers.authorization = `Bearer ${options.bearerToken}`;
  if (options.rawAuthorization) headers.authorization = options.rawAuthorization;


  const cookies: Record<string, string> = {};
  if (options.cookieToken) cookies.token = options.cookieToken;


  return { headers, cookies } as unknown as Request;
}


function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}


function expectAuthError(fn: () => void, status: number): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CustomError);
    expect((error as CustomError & { statusCode: number }).statusCode).toBe(status);
    return;
  }
  throw new Error(
    `Expected a CustomError with status ${status}, but nothing was thrown.`,
  );
}


describe("AuthMiddleware", () => {
  const middleware = new AuthMiddleware();


  describe("required authentication — auth({ userTypes: 'all' })", () => {
    it("throws 401 and does not call next when no token is provided", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest();
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 401);


      expect(next).not.toHaveBeenCalled();
    });


    it("calls next and populates req.user with a valid Bearer token", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const user = anAuthenticatedUser();
      const req = mockRequest({ bearerToken: signJwt(user) });
      const next = mockNext();


      handler(req, RES, next);


      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toMatchObject({
        id: user.id,
        userType: "STUDENT",
        isManager: false,
      });
    });


    it("calls next and populates req.user with a valid cookie token", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const user = anAuthenticatedUser();
      const req = mockRequest({ cookieToken: signJwt(user) });
      const next = mockNext();


      handler(req, RES, next);


      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toMatchObject({
        id: user.id,
        userType: "STUDENT",
        isManager: false,
      });
    });


    it("throws 401 for a malformed token", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ bearerToken: MALFORMED_TOKEN });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 401);


      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });


    it("throws 401 for a token with an invalid signature", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ bearerToken: aTokenWithInvalidSignature() });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 401);


      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });


    it("throws 401 for an expired token", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ bearerToken: anExpiredToken() });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 401);


      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });


    it("throws 401 when the Authorization header lacks the Bearer scheme", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({
        rawAuthorization: signJwt(anAuthenticatedUser()),
      });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 401);


      expect(next).not.toHaveBeenCalled();
    });


    it("clears a pre-existing req.user when validation fails", () => {
      const handler = middleware.auth({ userTypes: "all" });
      const req = mockRequest({ bearerToken: MALFORMED_TOKEN });
      req.user = anAuthenticatedUser({ id: "pre-existing-user" });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 401);


      expect(req.user).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });


  describe("optional authentication — auth()", () => {
    it("calls next anonymously when no token is provided", () => {
      const handler = middleware.auth();
      const req = mockRequest();
      const next = mockNext();


      handler(req, RES, next);


      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });


    it("calls next and populates req.user with a valid token", () => {
      const handler = middleware.auth();
      const user = anAuthenticatedUser();
      const req = mockRequest({ bearerToken: signJwt(user) });
      const next = mockNext();


      handler(req, RES, next);


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
    ])("ignores an %s token and proceeds anonymously", (_label, token) => {
      const handler = middleware.auth();
      const req = mockRequest({ bearerToken: token });
      const next = mockNext();


      handler(req, RES, next);


      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });
  });


  describe("authorization", () => {
    it.each(["STUDENT", "TEACHER"] as const)(
      'userTypes "all" allows %s',
      (userType) => {
        const handler = middleware.auth({ userTypes: "all" });
        const req = mockRequest({
          bearerToken: signJwt(anAuthenticatedUser({ userType })),
        });
        const next = mockNext();


        handler(req, RES, next);


        expect(next).toHaveBeenCalledTimes(1);
      },
    );


    it("calls next when the userType is explicitly allowed", () => {
      const handler = middleware.auth({ userTypes: ["TEACHER"] });
      const req = mockRequest({
        bearerToken: signJwt(anAuthenticatedUser({ userType: "TEACHER" })),
      });
      const next = mockNext();


      handler(req, RES, next);


      expect(next).toHaveBeenCalledTimes(1);
    });


    it("throws 403 when the userType is not allowed", () => {
      const handler = middleware.auth({ userTypes: ["TEACHER"] });
      const req = mockRequest({
        bearerToken: signJwt(anAuthenticatedUser({ userType: "STUDENT" })),
      });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 403);


      expect(next).not.toHaveBeenCalled();
    });


    it("calls next for a manager when manager: true", () => {
      const handler = middleware.auth({ manager: true });
      const req = mockRequest({
        bearerToken: signJwt(anAuthenticatedUser({ isManager: true })),
      });
      const next = mockNext();


      handler(req, RES, next);


      expect(next).toHaveBeenCalledTimes(1);
    });


    it("throws 403 for a non-manager when manager: true", () => {
      const handler = middleware.auth({ manager: true });
      const req = mockRequest({
        bearerToken: signJwt(anAuthenticatedUser({ isManager: false })),
      });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 403);


      expect(next).not.toHaveBeenCalled();
    });


    it("does not let a manager bypass userTypes restrictions", () => {
      const handler = middleware.auth({ userTypes: ["TEACHER"] });
      const req = mockRequest({
        bearerToken: signJwt(
          anAuthenticatedUser({ userType: "STUDENT", isManager: true }),
        ),
      });
      const next = mockNext();


      expectAuthError(() => handler(req, RES, next), 403);


      expect(next).not.toHaveBeenCalled();
    });
  });
});
