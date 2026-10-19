import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { ActivityStatus, ActivityType } from "@prisma/client";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
import EnrollmentRepository from "@/repositories/enrollment/EnrollmentRepository.js";
import {
  anAddress,
  createActivity,
  createEnrollment,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import {
  authCookie,
  authHeader,
  invalidToken,
  signToken,
} from "../../helpers/auth.js";
import { daysFromNow } from "../../helpers/dates.js";

const activitiesUrl = "/users/me/activities";
const FILTERS = ["enrolled", "completed", "managed"] as const;
const FILTER_MESSAGE = "filter must be one of: enrolled, completed, managed.";
const INVALID_QUERY_MESSAGE = "Invalid query parameters.";

function listActivities(token: string, query = "") {
  return request(app)
    .get(`${activitiesUrl}${query}`)
    .set(...authHeader(token));
}

function idsOf(response: request.Response): string[] {
  return response.body.items.map((item: { id: string }) => item.id);
}

function sorted(ids: string[]): string[] {
  return [...ids].sort();
}

function itemOf(response: request.Response, activityId: string) {
  return response.body.items.find(
    (item: { id: string }) => item.id === activityId,
  );
}

/** The factory always creates ActivityDetails, so this goes straight to Prisma. */
async function createActivityWithoutDetails(
  authorId: string,
  overrides: Partial<{
    title: string;
    type: ActivityType;
    status: ActivityStatus;
    startDate: Date;
    deletedAt: Date | null;
  }> = {},
) {
  return prisma.activity.create({
    data: {
      authorId,
      title: "Atividade sem detalhes",
      type: "OTHER",
      campus: "ARAPIRACA",
      startDate: daysFromNow(7),
      endDate: daysFromNow(14),
      slots: 30,
      status: "OPEN",
      ...overrides,
    },
  });
}

/**
 * Builds a dataset where every filter has its own distinct members plus every
 * exclusion rule of the contract. `user` is the token owner under test.
 */
async function seedHistory() {
  const user = await createTeacher();
  const other = await createTeacher();
  const author = await createTeacher();

  const enrollIn = async (
    title: string,
    status: ActivityStatus,
    enrollment: Parameters<typeof createEnrollment>[2] = {},
    activity: { deletedAt?: Date } = {},
  ) => {
    const created = await createActivity(author.user.id, {
      title,
      status,
      address: anAddress(),
      ...activity,
    });
    await createEnrollment(user.user.id, created.id, enrollment);
    return created.id;
  };

  const managedBy = async (
    title: string,
    status: ActivityStatus,
    extra: { deletedAt?: Date } = {},
  ) => {
    const created = await createActivity(user.user.id, {
      title,
      status,
      address: anAddress(),
      ...extra,
    });
    return created.id;
  };

  // enrolled
  const enrolledOpen = await enrollIn("enrolled-open", "OPEN");
  const enrolledInProgress = await enrollIn("enrolled-in-progress", "IN_PROGRESS");
  // IN_PROGRESS with attendance already confirmed: stays in enrolled, never in completed
  const inProgressConfirmed = await enrollIn("in-progress-confirmed", "IN_PROGRESS", {
    attendanceConfirmed: true,
  });

  // completed
  const completedOk = await enrollIn("completed-ok", "COMPLETED", {
    attendanceConfirmed: true,
  });

  // excluded from enrolled and completed
  const completedAbsent = await enrollIn("completed-absent", "COMPLETED", {
    attendanceConfirmed: false,
  });
  const completedNotRecorded = await enrollIn("completed-not-recorded", "COMPLETED", {
    attendanceConfirmed: null,
  });
  const cancelledConfirmed = await enrollIn("cancelled-confirmed", "CANCELLED", {
    attendanceConfirmed: true,
  });
  const cancelledApproved = await enrollIn("cancelled-approved", "CANCELLED");

  // non-APPROVED enrollments, on an OPEN activity (enrolled) and on a COMPLETED one (completed)
  const openPending = await enrollIn("open-pending", "OPEN", { status: "PENDING" });
  const openRejected = await enrollIn("open-rejected", "OPEN", { status: "REJECTED" });
  const openCancelledEnrollment = await enrollIn("open-cancelled-enrollment", "OPEN", {
    status: "CANCELLED",
  });
  const completedPending = await enrollIn("completed-pending", "COMPLETED", {
    status: "PENDING",
    attendanceConfirmed: true,
  });
  const completedRejected = await enrollIn("completed-rejected", "COMPLETED", {
    status: "REJECTED",
    attendanceConfirmed: true,
  });
  const completedCancelledEnrollment = await enrollIn(
    "completed-cancelled-enrollment",
    "COMPLETED",
    { status: "CANCELLED", attendanceConfirmed: true },
  );

  // soft-deleted, one per filter
  const deletedEnrolled = await enrollIn(
    "deleted-enrolled",
    "OPEN",
    {},
    { deletedAt: new Date() },
  );
  const deletedCompleted = await enrollIn(
    "deleted-completed",
    "COMPLETED",
    { attendanceConfirmed: true },
    { deletedAt: new Date() },
  );
  const managedDeleted = await managedBy("managed-deleted", "OPEN", {
    deletedAt: new Date(),
  });

  // managed, in any status
  const managedOpen = await managedBy("managed-open", "OPEN");
  const managedCancelled = await managedBy("managed-cancelled", "CANCELLED");
  const managedCompleted = await managedBy("managed-completed", "COMPLETED");

  // the author is also enrolled in their own activity
  const managedAndEnrolled = await managedBy("managed-and-enrolled", "OPEN");
  await createEnrollment(user.user.id, managedAndEnrolled);

  // another user, with data that must never leak into `user`'s responses
  const otherManaged = (
    await createActivity(other.user.id, {
      title: "other-managed",
      address: anAddress(),
    })
  ).id;
  await createEnrollment(other.user.id, managedOpen);
  await createEnrollment(other.user.id, managedCompleted, {
    attendanceConfirmed: true,
  });
  await createEnrollment(other.user.id, enrolledOpen);

  return {
    user,
    other,
    ids: {
      enrolledOpen,
      enrolledInProgress,
      inProgressConfirmed,
      completedOk,
      completedAbsent,
      completedNotRecorded,
      cancelledConfirmed,
      cancelledApproved,
      openPending,
      openRejected,
      openCancelledEnrollment,
      completedPending,
      completedRejected,
      completedCancelledEnrollment,
      deletedEnrolled,
      deletedCompleted,
      managedDeleted,
      managedOpen,
      managedCancelled,
      managedCompleted,
      managedAndEnrolled,
      otherManaged,
    },
  };
}

describe("GET /users/me/activities", () => {
  // ---------- Filters ----------

  describe("filters", () => {
    let seed: Awaited<ReturnType<typeof seedHistory>>;

    beforeEach(async () => {
      seed = await seedHistory();
    });

    it("filter=enrolled returns APPROVED enrollments in OPEN or IN_PROGRESS activities", async () => {
      const response = await listActivities(seed.user.token, "?filter=enrolled");
      const { ids } = seed;

      expect(response.status).toBe(200);
      expect(sorted(idsOf(response))).toEqual(
        sorted([
          ids.enrolledOpen,
          ids.enrolledInProgress,
          ids.inProgressConfirmed,
          ids.managedAndEnrolled,
        ]),
      );
    });

    it("filter=completed returns APPROVED enrollments in COMPLETED activities, present or not yet homologated", async () => {
      const response = await listActivities(seed.user.token, "?filter=completed");

      expect(response.status).toBe(200);
      expect(sorted(idsOf(response))).toEqual(
        sorted([seed.ids.completedOk, seed.ids.completedNotRecorded]),
      );
    });

    it("filter=managed returns every activity the user authored, in any status", async () => {
      const response = await listActivities(seed.user.token, "?filter=managed");
      const { ids } = seed;

      expect(response.status).toBe(200);
      expect(sorted(idsOf(response))).toEqual(
        sorted([
          ids.managedOpen,
          ids.managedCancelled,
          ids.managedCompleted,
          ids.managedAndEnrolled,
        ]),
      );
    });

    it("returns distinct sets: enrolled and completed never overlap, managed only overlaps through the author's own enrollment", async () => {
      const [enrolled, completed, managed] = await Promise.all(
        FILTERS.map(async (filter) =>
          idsOf(await listActivities(seed.user.token, `?filter=${filter}`)),
        ),
      );

      expect(enrolled.filter((id) => completed.includes(id))).toEqual([]);
      expect(completed.filter((id) => managed.includes(id))).toEqual([]);
      expect(enrolled.filter((id) => managed.includes(id))).toEqual([
        seed.ids.managedAndEnrolled,
      ]);
    });

    it("lists an activity the author is also enrolled in once per filter, never duplicated", async () => {
      const enrolled = idsOf(await listActivities(seed.user.token, "?filter=enrolled"));
      const managed = idsOf(await listActivities(seed.user.token, "?filter=managed"));

      expect(enrolled.filter((id) => id === seed.ids.managedAndEnrolled)).toHaveLength(1);
      expect(managed.filter((id) => id === seed.ids.managedAndEnrolled)).toHaveLength(1);
    });

    it.each([
      ["COMPLETED activity", "completedAbsent"],
      ["CANCELLED activity", "cancelledApproved"],
      ["PENDING enrollment", "openPending"],
      ["REJECTED enrollment", "openRejected"],
      ["CANCELLED enrollment", "openCancelledEnrollment"],
      ["activity managed by someone else the user is not enrolled in", "otherManaged"],
    ] as const)("filter=enrolled excludes a %s", async (_label, key) => {
      const response = await listActivities(seed.user.token, "?filter=enrolled");

      expect(idsOf(response)).not.toContain(seed.ids[key]);
    });

    it.each([
      ["attendance marked as absent", "completedAbsent"],
      ["CANCELLED activity with attendance confirmed", "cancelledConfirmed"],
      ["IN_PROGRESS activity with attendance confirmed", "inProgressConfirmed"],
      ["PENDING enrollment", "completedPending"],
      ["REJECTED enrollment", "completedRejected"],
      ["CANCELLED enrollment", "completedCancelledEnrollment"],
    ] as const)("filter=completed excludes %s", async (_label, key) => {
      const response = await listActivities(seed.user.token, "?filter=completed");

      expect(idsOf(response)).not.toContain(seed.ids[key]);
    });

    it("filter=managed ignores activities the user is only enrolled in", async () => {
      const response = await listActivities(seed.user.token, "?filter=managed");
      const returned = idsOf(response);

      expect(returned).not.toContain(seed.ids.enrolledOpen);
      expect(returned).not.toContain(seed.ids.completedOk);
    });

    it("does not list an activity under managed for a moderator who is not the author", async () => {
      const moderator = await createTeacher();
      const activity = await createActivity(seed.other.user.id, {
        title: "moderated-by-someone-else",
      });
      await createEnrollment(moderator.user.id, activity.id, { isModerator: true });

      const managed = await listActivities(moderator.token, "?filter=managed");
      const enrolled = await listActivities(moderator.token, "?filter=enrolled");

      expect(managed.body.items).toEqual([]);
      expect(idsOf(enrolled)).toEqual([activity.id]);
    });

    it.each(FILTERS)(
      "filter=%s never returns a soft-deleted activity",
      async (filter) => {
        const response = await listActivities(seed.user.token, `?filter=${filter}`);
        const returned = idsOf(response);

        expect(response.status).toBe(200);
        expect(returned).not.toContain(seed.ids.deletedEnrolled);
        expect(returned).not.toContain(seed.ids.deletedCompleted);
        expect(returned).not.toContain(seed.ids.managedDeleted);
      },
    );
  });

  // ---------- Isolation between users ----------

  describe("isolation between users", () => {
    let seed: Awaited<ReturnType<typeof seedHistory>>;

    beforeEach(async () => {
      seed = await seedHistory();
    });

    it.each(FILTERS)(
      "filter=%s never returns data that belongs only to another user",
      async (filter) => {
        const response = await listActivities(seed.user.token, `?filter=${filter}`);

        expect(response.status).toBe(200);
        expect(idsOf(response)).not.toContain(seed.ids.otherManaged);
      },
    );

    it("does not show user A the enrollments of user B", async () => {
      const a = await listActivities(seed.user.token, "?filter=enrolled");

      // B is approved in A's managedOpen, but A is not enrolled there
      expect(idsOf(a)).not.toContain(seed.ids.managedOpen);
    });

    it("shows user B only B's own enrollments and activities", async () => {
      const enrolled = await listActivities(seed.other.token, "?filter=enrolled");
      const completed = await listActivities(seed.other.token, "?filter=completed");
      const managed = await listActivities(seed.other.token, "?filter=managed");
      const { ids } = seed;

      expect(sorted(idsOf(enrolled))).toEqual(sorted([ids.managedOpen, ids.enrolledOpen]));
      expect(idsOf(completed)).toEqual([ids.managedCompleted]);
      expect(idsOf(managed)).toEqual([ids.otherManaged]);
    });
  });

  // ---------- 401 - Unauthenticated ----------

  describe("authentication", () => {
    const query = "?filter=enrolled";

    it("accepts the Bearer token", async () => {
      const user = await createStudent();

      const response = await request(app)
        .get(`${activitiesUrl}${query}`)
        .set(...authHeader(user.token));

      expect(response.status).toBe(200);
    });

    it("accepts the session cookie", async () => {
      const user = await createStudent();

      const response = await request(app)
        .get(`${activitiesUrl}${query}`)
        .set(...authCookie(user.token));

      expect(response.status).toBe(200);
    });

    it("rejects a request with no credential", async () => {
      const response = await request(app).get(`${activitiesUrl}${query}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ status: 401, code: "UNAUTHENTICATED", message: "No token provided." });
    });

    it.each([
      ["a token with an invalid signature", () => invalidToken()],
      ["a malformed token", () => "not-a-jwt"],
    ])("rejects %s", async (_label, buildToken) => {
      const response = await request(app)
        .get(`${activitiesUrl}${query}`)
        .set(...authHeader(buildToken()));

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Token malformatted, expired or invalid.",
      });
    });

    it("rejects an expired token", async () => {
      const user = await createStudent();
      const expired = signToken(
        { id: user.user.id, userType: "STUDENT", isManager: false },
        "-1h",
      );

      const response = await request(app)
        .get(`${activitiesUrl}${query}`)
        .set(...authHeader(expired));

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Token malformatted, expired or invalid.",
      });
    });

    it("answers 401 before validating the query", async () => {
      const response = await request(app)
        .get(`${activitiesUrl}?filter=nope&page=0`)
        .set(...authHeader(invalidToken()));

      expect(response.status).toBe(401);
    });
  });

  // ---------- 400 - Validation ----------

  describe("validation", () => {
    it("rejects a missing filter", async () => {
      const { token } = await createStudent();

      const response = await listActivities(token);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(INVALID_QUERY_MESSAGE);
      expect(response.body.errors).toContainEqual({
        field: "filter",
        code: "VALIDATION_ERROR",
        message: FILTER_MESSAGE,
      });
    });

    it.each(["inscritas", "concluidas", "gerenciadas", "all", ""])(
      "rejects the invalid filter %j",
      async (value) => {
        const { token } = await createStudent();

        const response = await listActivities(token, `?filter=${value}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe(INVALID_QUERY_MESSAGE);
        expect(response.body.errors).toContainEqual({
          field: "filter",
          code: "VALIDATION_ERROR",
          message: FILTER_MESSAGE,
        });
      },
    );

    it.each(["0", "-1", "abc", "1.5"])("rejects page=%s", async (page) => {
      const { token } = await createStudent();

      const response = await listActivities(token, `?filter=enrolled&page=${page}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(INVALID_QUERY_MESSAGE);
      expect(response.body.errors.map((e: { field: string }) => e.field)).toEqual(["page"]);
    });

    it.each(["0", "-1", "abc", "1.5", "101"])("rejects limit=%s", async (limit) => {
      const { token } = await createStudent();

      const response = await listActivities(token, `?filter=enrolled&limit=${limit}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(INVALID_QUERY_MESSAGE);
      expect(response.body.errors.map((e: { field: string }) => e.field)).toEqual(["limit"]);
    });

    it("collects every invalid parameter instead of stopping at the first", async () => {
      const { token } = await createStudent();

      const response = await listActivities(token, "?filter=nope&page=0&limit=101");

      expect(response.status).toBe(400);
      expect(
        response.body.errors.map((e: { field: string }) => e.field).sort(),
      ).toEqual(["filter", "limit", "page"]);
    });

    it("rejects an unknown query param", async () => {
      const { token } = await createStudent();

      const response = await listActivities(token, "?filter=enrolled&foo=bar");

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual([
        {
          field: "foo",
          code: "UNKNOWN_PARAMETER",
          message: "foo is not a supported query parameter.",
        },
      ]);
    });

    it("answers 400 before checking whether the user exists", async () => {
      const student = await createStudent();
      await prisma.user.delete({ where: { id: student.user.id } });

      const response = await listActivities(student.token, "?filter=nope");

      expect(response.status).toBe(400);
    });
  });

  // ---------- 404 - User gone ----------

  describe("user from the token no longer exists", () => {
    it("returns 404 with the contract body", async () => {
      const student = await createStudent();
      await prisma.user.delete({ where: { id: student.user.id } });

      const response = await listActivities(student.token, "?filter=enrolled");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ status: 404, code: "NOT_FOUND", message: "User not found." });
    });
  });

  // ---------- Response shape ----------

  describe("response", () => {
    it.each(FILTERS)(
      "returns 200 with an empty page for filter=%s when the user has nothing",
      async (filter) => {
        const { token } = await createStudent();

        const response = await listActivities(token, `?filter=${filter}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      },
    );

    it("returns each activity as GET /activities/:activityId does, plus the enrollment and the certificate", async () => {
      const user = await createTeacher();
      const activity = await createActivity(user.user.id, {
        title: "Oficina de Testes",
        status: "IN_PROGRESS",
        address: anAddress(),
      });

      const [history, detail] = await Promise.all([
        listActivities(user.token, "?filter=managed"),
        request(app).get(`/activities/${activity.id}`),
      ]);

      expect(detail.status).toBe(200);
      expect(history.body.items).toEqual([
        { ...detail.body, enrollment: null, certificate: null },
      ]);
    });

    it("serializes the user's enrollment in its canonical form", async () => {
      const user = await createStudent();
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { status: "COMPLETED" });
      const enrollment = await createEnrollment(user.user.id, activity.id, {
        attendanceConfirmed: true,
        confirmedWorkloadHours: 12,
      });

      const response = await listActivities(user.token, "?filter=completed");

      expect(response.status).toBe(200);
      expect(response.body.items[0].enrollment).toEqual({
        id: enrollment.id,
        activityId: activity.id,
        userId: user.user.id,
        status: "APPROVED",
        attendanceConfirmed: true,
        confirmedWorkloadHours: 12,
        createdAt: enrollment.createdAt.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString(),
      });
    });

    it("returns the author's own enrollment under managed when they are enrolled", async () => {
      const seed = await seedHistory();

      const response = await listActivities(seed.user.token, "?filter=managed");

      expect(itemOf(response, seed.ids.managedAndEnrolled).enrollment).toMatchObject({
        userId: seed.user.user.id,
        activityId: seed.ids.managedAndEnrolled,
        status: "APPROVED",
      });
      expect(itemOf(response, seed.ids.managedOpen).enrollment).toBeNull();
    });

    it("returns the certificate under completed when presence was homologated, null when not yet", async () => {
      const user = await createStudent();
      const author = await createTeacher();
      const homologated = await createActivity(author.user.id, { status: "COMPLETED" });
      const pending = await createActivity(author.user.id, { status: "COMPLETED" });
      const enrollment = await createEnrollment(user.user.id, homologated.id);
      await createEnrollment(user.user.id, pending.id);
      await new EnrollmentRepository().confirmAttendance(
        homologated.id,
        enrollment.id,
        true,
        8,
      );
      const certificate = await prisma.certificate.findUniqueOrThrow({
        where: { enrollmentId: enrollment.id },
      });

      const response = await listActivities(user.token, "?filter=completed");

      expect(response.status).toBe(200);
      expect(itemOf(response, homologated.id).certificate).toEqual({
        id: certificate.id,
        validationCode: certificate.validationCode,
        issuedAt: certificate.issuedAt.toISOString(),
      });
      expect(itemOf(response, pending.id).certificate).toBeNull();
    });

    it.each(FILTERS)(
      "always carries certificate on the items of filter=%s",
      async (filter) => {
        const seed = await seedHistory();

        const response = await listActivities(seed.user.token, `?filter=${filter}`);

        expect(response.body.items.length).toBeGreaterThan(0);
        for (const item of response.body.items) {
          expect(item).toHaveProperty("certificate", null);
        }
      },
    );

    it("returns details as null for an activity without details", async () => {
      const user = await createTeacher();
      const activity = await createActivityWithoutDetails(user.user.id, {
        title: "Study Group",
      });

      const response = await listActivities(user.token, "?filter=managed");

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([
        expect.objectContaining({ id: activity.id, details: null }),
      ]);
    });

    it("orders by startDate descending", async () => {
      const user = await createTeacher();
      await createActivity(user.user.id, { title: "middle", startDate: daysFromNow(10) });
      await createActivity(user.user.id, { title: "latest", startDate: daysFromNow(20) });
      await createActivity(user.user.id, { title: "earliest", startDate: daysFromNow(5) });

      const response = await listActivities(user.token, "?filter=managed");

      expect(
        response.body.items.map((item: { title: string }) => item.title),
      ).toEqual(["latest", "middle", "earliest"]);
    });

    it("breaks startDate ties by id ascending, so pagination is deterministic", async () => {
      const user = await createTeacher();
      const sameDate = daysFromNow(3);
      const created = await Promise.all(
        ["a", "b", "c"].map((title) =>
          createActivity(user.user.id, { title, startDate: sameDate }),
        ),
      );

      const response = await listActivities(user.token, "?filter=managed");

      expect(idsOf(response)).toEqual(sorted(created.map((a) => a.id)));
    });

    describe("pagination", () => {
      it("splits results across pages with a consistent envelope", async () => {
        const user = await createTeacher();
        for (let day = 1; day <= 5; day += 1) {
          await createActivity(user.user.id, {
            title: `activity-${day}`,
            startDate: daysFromNow(day),
          });
        }

        const first = await listActivities(user.token, "?filter=managed&page=1&limit=2");
        const second = await listActivities(user.token, "?filter=managed&page=2&limit=2");
        const third = await listActivities(user.token, "?filter=managed&page=3&limit=2");

        const pageOf = (response: request.Response) => {
          const { items: _items, ...envelope } = response.body;
          return envelope;
        };
        expect(pageOf(first)).toEqual({ total: 5, page: 1, limit: 2, totalPages: 3 });
        expect(pageOf(second)).toEqual({ total: 5, page: 2, limit: 2, totalPages: 3 });
        expect(pageOf(third)).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
        expect(first.body.items).toHaveLength(2);
        expect(second.body.items).toHaveLength(2);
        expect(third.body.items).toHaveLength(1);

        const allIds = [...idsOf(first), ...idsOf(second), ...idsOf(third)];
        expect(new Set(allIds).size).toBe(5);
      });

      it("returns 200 with an empty list and the real total for a page beyond the last one", async () => {
        const user = await createTeacher();
        await createActivity(user.user.id);
        await createActivity(user.user.id);

        const response = await listActivities(user.token, "?filter=managed&page=4&limit=2");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          items: [],
          total: 2,
          page: 4,
          limit: 2,
          totalPages: 1,
        });
      });

      it("answers an empty page, not 500, for a page too large to offset", async () => {
        const user = await createTeacher();
        await createActivity(user.user.id);

        const response = await listActivities(
          user.token,
          "?filter=managed&page=99999999999999999999",
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ items: [], total: 1, totalPages: 1 });
      });

      it("defaults to page 1 and limit 20", async () => {
        const user = await createTeacher();
        await createActivity(user.user.id);

        const response = await listActivities(user.token, "?filter=managed");

        expect(response.body).toMatchObject({
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      });

      it("accepts limit=100, the maximum", async () => {
        const user = await createTeacher();
        await createActivity(user.user.id);

        const response = await listActivities(user.token, "?filter=managed&limit=100");

        expect(response.status).toBe(200);
        expect(response.body.limit).toBe(100);
      });
    });
  });
});