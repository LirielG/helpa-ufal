import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { config } from "@/config";
import {
  makeAction,
  makeActionDetail,
  makeEnrollment,
  makeSigaaActivity,
  makeUser,
} from "./factories";


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
    HttpResponse.json(makeUser(), { status: 201 }),
  ),

  http.post(
    `${API}/auth/logout`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  http.get(`${API}/users/me`, () =>
    HttpResponse.json({
      ...makeUser(),
      registrationCode: "2026000001",
      course: "Ciência da Computação",
      cndb: null,
    }),
  ),

  http.get(`${API}/activities`, () =>
    HttpResponse.json({
      activities: [makeAction()],
      total: 1,
    }),
  ),

  http.get(`${API}/activities/:id`, ({ params }) =>
    HttpResponse.json(makeActionDetail({ id: String(params.id) })),
  ),

  // Declared before /sigaa-activities so the literal path wins over the list.
  http.get(`${API}/sigaa-activities/filters`, () =>
    HttpResponse.json({
      types: ["CURSO", "EVENTO"],
      departments: ["Instituto de Computação"],
    }),
  ),

  http.get(`${API}/sigaa-activities`, () =>
    HttpResponse.json({
      items: [makeSigaaActivity()],
      total: 1,
      page: 1,
      limit: 10,
    }),
  ),

  // Default happy-path handler for the enrollment list endpoint (#145).
  // Tests that need error scenarios override this with server.use(...).
  http.get(`${API}/activities/:id/enrollments`, () =>
    HttpResponse.json({
      items: [makeEnrollment()],
      total: 1,
      page: 1,
      limit: 20,
      totalPresent: 0,
    }),
  ),
];

export const server = setupServer(...handlers);

export { delay, http, HttpResponse };
