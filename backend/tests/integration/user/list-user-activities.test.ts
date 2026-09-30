import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { ActivityStatus, ActivityType } from "@prisma/client";
import { app } from "@/app.js";
import { prisma } from "@/database/prisma.js";
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
const FILTER_MESSAGE = "Must be one of: enrolled, completed, managed.";
const EXPECTED_LOCATION =
  "Av. Manoel Severino Barbosa, 100, Bom Sucesso, Arapiraca - AL";

function listActivities(token: string, query = "") {
  return request(app)
    .get(`${activitiesUrl}${query}`)
    .set(...authHeader(token));
}

function idsOf(response: request.Response): string[] {
  return response.body.data.map((item: { id: string }) => item.id);
}

function sorted(ids: string[]): string[] {
  return [...ids].sort();
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

    it("filter=completed returns APPROVED enrollments with attendance confirmed in COMPLETED activities", async () => {
      const response = await listActivities(seed.user.token, "?filter=completed");

      expect(response.status).toBe(200);
      expect(idsOf(response)).toEqual([seed.ids.completedOk]);
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
      ["attendance not recorded yet", "completedNotRecorded"],
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

      expect(managed.body.data).toEqual([]);
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
      expect(response.body).toEqual({ status: 401, message: "No token provided." });
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
      expect(response.body.message).toBe("Validation error.");
      expect(response.body.errors).toContainEqual({
        field: "filter",
        message: FILTER_MESSAGE,
      });
    });

    it.each(["inscritas", "concluidas", "gerenciadas", "all", ""])(
      "rejects the invalid filter %j",
      async (value) => {
        const { token } = await createStudent();

        const response = await listActivities(token, `?filter=${value}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Validation error.");
        expect(response.body.errors).toContainEqual({
          field: "filter",
          message: FILTER_MESSAGE,
        });
      },
    );

    it.each(["0", "-1", "abc", "1.5"])("rejects page=%s", async (page) => {
      const { token } = await createStudent();

      const response = await listActivities(token, `?filter=enrolled&page=${page}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation error.");
      expect(response.body.errors.map((e: { field: string }) => e.field)).toEqual(["page"]);
    });

    it.each(["0", "-1", "abc", "1.5", "51"])("rejects limit=%s", async (limit) => {
      const { token } = await createStudent();

      const response = await listActivities(token, `?filter=enrolled&limit=${limit}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation error.");
      expect(response.body.errors.map((e: { field: string }) => e.field)).toEqual(["limit"]);
    });

    it("collects every invalid parameter instead of stopping at the first", async () => {
      const { token } = await createStudent();

      const response = await listActivities(token, "?filter=nope&page=0&limit=51");

      expect(response.status).toBe(400);
      expect(
        response.body.errors.map((e: { field: string }) => e.field).sort(),
      ).toEqual(["filter", "limit", "page"]);
    });

    it("ignores unknown query params", async () => {
      const { token } = await createStudent();

      const response = await listActivities(token, "?filter=enrolled&foo=bar");

      expect(response.status).toBe(200);
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
      expect(response.body).toEqual({ status: 404, message: "User not found." });
    });
  });

  // ---------- Response shape ----------

  describe("response", () => {
    it.each(FILTERS)(
      "returns 200 with an empty list and zeroed meta for filter=%s when the user has nothing",
      async (filter) => {
        const { token } = await createStudent();

        const response = await listActivities(token, `?filter=${filter}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        });
      },
    );

    it("serializes every DTO field as the contract defines", async () => {
      const user = await createTeacher();
      const activity = await createActivity(user.user.id, {
        title: "Oficina de Testes",
        type: "COURSE",
        status: "IN_PROGRESS",
        description: "Oficina prática de testes.",
        workloadHours: 8,
        address: anAddress(),
      });

      const response = await listActivities(user.token, "?filter=managed");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [
          {
            id: activity.id,
            title: "Oficina de Testes",
            description: "Oficina prática de testes.",
            location: EXPECTED_LOCATION,
            startDate: activity.startDate.toISOString(),
            status: "IN_PROGRESS",
            category: "COURSE",
            workloadHours: 8,
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it("never exposes the zipCode or other internal fields", async () => {
      const user = await createTeacher();
      await createActivity(user.user.id, { address: anAddress() });

      const response = await listActivities(user.token, "?filter=managed");

      expect(Object.keys(response.body.data[0]).sort()).toEqual(
        [
          "category",
          "description",
          "id",
          "location",
          "startDate",
          "status",
          "title",
          "workloadHours",
        ].sort(),
      );
      expect(response.body.data[0].location).not.toContain("57309-005");
    });

    it("returns description, location and workloadHours as null for an activity without details", async () => {
      const user = await createTeacher();
      const activity = await createActivityWithoutDetails(user.user.id, {
        title: "Study Group",
        type: "OTHER",
      });

      const response = await listActivities(user.token, "?filter=managed");

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        {
          id: activity.id,
          title: "Study Group",
          description: null,
          location: null,
          startDate: activity.startDate.toISOString(),
          status: "OPEN",
          category: "OTHER",
          workloadHours: null,
        },
      ]);
    });

    it("returns location as null when the details have no address", async () => {
      const user = await createTeacher();
      await createActivity(user.user.id, {
        format: "ONLINE",
        url: "https://meet.example.com/abc",
        description: "Palestra online.",
        workloadHours: 4,
      });

      const response = await listActivities(user.token, "?filter=managed");

      expect(response.status).toBe(200);
      expect(response.body.data[0]).toMatchObject({
        description: "Palestra online.",
        location: null,
        workloadHours: 4,
      });
    });

    it("orders by startDate descending", async () => {
      const user = await createTeacher();
      await createActivity(user.user.id, { title: "middle", startDate: daysFromNow(10) });
      await createActivity(user.user.id, { title: "latest", startDate: daysFromNow(20) });
      await createActivity(user.user.id, { title: "earliest", startDate: daysFromNow(5) });

      const response = await listActivities(user.token, "?filter=managed");

      expect(
        response.body.data.map((item: { title: string }) => item.title),
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
      it("splits results across pages with a consistent meta", async () => {
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

        expect(first.body.meta).toEqual({ total: 5, page: 1, limit: 2, totalPages: 3 });
        expect(second.body.meta).toEqual({ total: 5, page: 2, limit: 2, totalPages: 3 });
        expect(third.body.meta).toEqual({ total: 5, page: 3, limit: 2, totalPages: 3 });
        expect(first.body.data).toHaveLength(2);
        expect(second.body.data).toHaveLength(2);
        expect(third.body.data).toHaveLength(1);

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
          data: [],
          meta: { total: 2, page: 4, limit: 2, totalPages: 1 },
        });
      });

      it("defaults to page 1 and limit 20", async () => {
        const user = await createTeacher();
        await createActivity(user.user.id);

        const response = await listActivities(user.token, "?filter=managed");

        expect(response.body.meta).toEqual({
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      });

      it("accepts limit=50, the maximum", async () => {
        const user = await createTeacher();
        await createActivity(user.user.id);

        const response = await listActivities(user.token, "?filter=managed&limit=50");

        expect(response.status).toBe(200);
        expect(response.body.meta.limit).toBe(50);
      });
    });
  });
});