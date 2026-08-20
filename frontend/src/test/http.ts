import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { config } from "@/config";
import { makeUser } from "./factories";

/** Base URL every handler is built from. Exported so a test can override one. */
export const API = config.apiUrl;

/**
 * Happy-path handlers for every endpoint the app calls today, so a test that
 * merely renders a form needs no MSW knowledge at all.
 *
 * Override per test with `server.use(...)`; setup.ts restores these defaults
 * after each test via `server.resetHandlers()`.
 */
export const handlers = [
  http.post(`${API}/auth/login`, () =>
    HttpResponse.json({ token: "test-token", user: makeUser() }),
  ),

  http.post(`${API}/auth/register`, () =>
    HttpResponse.json(
      { token: "test-token", user: makeUser() },
      { status: 201 },
    ),
  ),

  http.post(
    `${API}/auth/logout`,
    () => new HttpResponse(null, { status: 204 }),
  ),
];

export const server = setupServer(...handlers);

export { delay, http, HttpResponse };
