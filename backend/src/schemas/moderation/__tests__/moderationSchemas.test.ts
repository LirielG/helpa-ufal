import { describe, expect, it } from "vitest";
import {
  CreateModerationDecisionSchema,
  ListReportedActivitiesQuerySchema,
} from "../moderationSchemas.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@/schemas/common/PaginationSchemas.js";

const REPORT_ID_1 = "b2c3d4e5-0000-4000-8000-000000000007";
const REPORT_ID_2 = "b2c3d4e5-0000-4000-8000-000000000008";

function queryIssues(query: Record<string, unknown>) {
  const result = ListReportedActivitiesQuerySchema.safeParse(query);
  expect(result.success).toBe(false);
  return result.error!.issues;
}

function bodyIssues(body: unknown) {
  const result = CreateModerationDecisionSchema.safeParse(body);
  expect(result.success).toBe(false);
  return result.error!.issues;
}

describe("ListReportedActivitiesQuerySchema", () => {
  it("defaults to the first page of open reported activities", () => {
    expect(ListReportedActivitiesQuerySchema.parse({})).toEqual({
      page: 1,
      limit: DEFAULT_PAGE_LIMIT,
      status: "open",
    });
  });

  it("parses explicit values into their typed form", () => {
    expect(
      ListReportedActivitiesQuerySchema.parse({
        page: "3",
        limit: String(MAX_PAGE_LIMIT),
        status: "decided",
      }),
    ).toEqual({ page: 3, limit: MAX_PAGE_LIMIT, status: "decided" });
  });

  it("accepts status=open explicitly", () => {
    expect(
      ListReportedActivitiesQuerySchema.parse({ status: "open" }).status,
    ).toBe("open");
  });

  it("accepts page up to Number.MAX_SAFE_INTEGER", () => {
    expect(
      ListReportedActivitiesQuerySchema.parse({
        page: String(Number.MAX_SAFE_INTEGER),
      }).page,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each(["", "OPEN", "DECIDED", "resolved", "true"])(
    "rejects status=%j instead of falling back to the default",
    (value) => {
      const issues = queryIssues({ status: value });

      expect(issues).toHaveLength(1);
      expect(issues[0]!.path).toEqual(["status"]);
      expect(issues[0]!.message).toBe("status must be one of: open, decided.");
    },
  );

  it.each([
    "0",
    "-1",
    "1.5",
    "abc",
    "",
    String(Number.MAX_SAFE_INTEGER + 1),
    "99999999999999999999",
    `1${"0".repeat(310)}`,
  ])("rejects page=%j", (value) => {
    const issues = queryIssues({ page: value });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(["page"]);
    expect(issues[0]!.message).toBe("page must be a positive integer.");
  });

  it("rejects limit above the shared ceiling instead of clamping it", () => {
    const issues = queryIssues({ limit: String(MAX_PAGE_LIMIT + 1) });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(["limit"]);
    expect(issues[0]!.message).toBe(`limit must be at most ${MAX_PAGE_LIMIT}.`);
  });

  it("rejects unknown query parameters", () => {
    const issues = queryIssues({ resolved: "false", search: "x" });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe("unrecognized_keys");
    expect((issues[0] as { keys: string[] }).keys).toEqual([
      "resolved",
      "search",
    ]);
  });
});

describe("CreateModerationDecisionSchema", () => {
  it.each(["UPHELD", "REJECTED"] as const)(
    "accepts verdict=%s, trims justification, and accepts reportIds",
    (verdict) => {
      expect(
        CreateModerationDecisionSchema.parse({
          verdict,
          justification: "  Conteúdo fora das diretrizes institucionais.  ",
          reportIds: [REPORT_ID_1, REPORT_ID_2],
        }),
      ).toEqual({
        verdict,
        justification: "Conteúdo fora das diretrizes institucionais.",
        reportIds: [REPORT_ID_1, REPORT_ID_2],
      });
    },
  );

  it("accepts boundary justification lengths of 1 and 500 characters after trim", () => {
    expect(
      CreateModerationDecisionSchema.parse({
        verdict: "REJECTED",
        justification: " a ",
        reportIds: [REPORT_ID_1],
      }).justification,
    ).toBe("a");

    const max = "x".repeat(500);
    expect(
      CreateModerationDecisionSchema.parse({
        verdict: "UPHELD",
        justification: `  ${max}  `,
        reportIds: [REPORT_ID_1],
      }).justification,
    ).toBe(max);
  });

  it.each(["", "   ", "\t\n", "x".repeat(501)])(
    "rejects invalid justification length (%j) with field justification",
    (justification) => {
      const issues = bodyIssues({
        verdict: "REJECTED",
        justification,
        reportIds: [REPORT_ID_1],
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]!.path).toEqual(["justification"]);
    },
  );

  it("rejects missing or non-string justification", () => {
    for (const value of [undefined, null, 123]) {
      const issues = bodyIssues({
        verdict: "REJECTED",
        justification: value,
        reportIds: [REPORT_ID_1],
      });
      expect(issues).toHaveLength(1);
      expect(issues[0]!.path).toEqual(["justification"]);
    }
  });

  it.each(["upheld", "APPROVED", "", undefined, null])(
    "rejects invalid verdict=%j with field verdict",
    (verdict) => {
      const issues = bodyIssues({
        verdict,
        justification: "Justificativa válida.",
        reportIds: [REPORT_ID_1],
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]!.path).toEqual(["verdict"]);
    },
  );

  it.each([undefined, null, "not-an-array", []])(
    "rejects missing, non-array, or empty reportIds (%j)",
    (reportIds) => {
      const issues = bodyIssues({
        verdict: "REJECTED",
        justification: "Justificativa válida.",
        reportIds,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]!.path).toEqual(["reportIds"]);
    },
  );

  it("rejects non-UUID entries inside reportIds with element path", () => {
    const issues = bodyIssues({
      verdict: "REJECTED",
      justification: "Justificativa válida.",
      reportIds: [REPORT_ID_1, "not-a-uuid"],
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(["reportIds", 1]);
  });

  it("rejects unknown keys in the request body", () => {
    const issues = bodyIssues({
      verdict: "REJECTED",
      justification: "Justificativa válida.",
      reportIds: [REPORT_ID_1],
      extra: true,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe("unrecognized_keys");
  });

  it.each([undefined, null, "text", []])(
    "rejects non-object body (%j) with a clear message",
    (body) => {
      const issues = bodyIssues(body);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.message).toBe("Request body must be a JSON object.");
    },
  );
});
