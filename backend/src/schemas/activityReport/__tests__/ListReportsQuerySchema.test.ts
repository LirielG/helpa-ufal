import { describe, it, expect } from "vitest";
import { ListReportsQuerySchema } from "../activityReportSchemas.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@/schemas/common/PaginationSchemas.js";

function issuesOf(query: Record<string, unknown>) {
  const result = ListReportsQuerySchema.safeParse(query);
  expect(result.success).toBe(false);
  return result.error!.issues;
}

describe("ListReportsQuerySchema", () => {
  // ---------- Defaults ----------

  it("defaults to the first page of open reports", () => {
    expect(ListReportsQuerySchema.parse({})).toEqual({
      page: 1,
      limit: DEFAULT_PAGE_LIMIT,
      resolved: false,
    });
  });

  it("parses explicit values into their typed form", () => {
    expect(
      ListReportsQuerySchema.parse({
        page: "3",
        limit: String(MAX_PAGE_LIMIT),
        resolved: "true",
      }),
    ).toEqual({ page: 3, limit: MAX_PAGE_LIMIT, resolved: true });
  });

  it("accepts resolved=false explicitly", () => {
    expect(ListReportsQuerySchema.parse({ resolved: "false" }).resolved).toBe(
      false,
    );
  });

  // ---------- resolved ----------

  it.each(["", "TRUE", "1", "yes"])(
    "rejects resolved=%j instead of falling back to the default",
    (value) => {
      const issues = issuesOf({ resolved: value });

      expect(issues).toHaveLength(1);
      expect(issues[0]!.path).toEqual(["resolved"]);
      expect(issues[0]!.message).toBe("resolved must be true or false.");
    },
  );

  // ---------- Pagination ----------

  it.each(["0", "-1", "1.5", "abc", ""])("rejects page=%j", (value) => {
    const issues = issuesOf({ page: value });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(["page"]);
    expect(issues[0]!.message).toBe("page must be a positive integer.");
  });

  it("rejects limit above the shared ceiling instead of clamping it", () => {
    const issues = issuesOf({ limit: String(MAX_PAGE_LIMIT + 1) });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toEqual(["limit"]);
    expect(issues[0]!.message).toBe(`limit must be at most ${MAX_PAGE_LIMIT}.`);
  });

  // ---------- Strictness ----------

  it("rejects unknown parameters, keeping the pagination schema strict", () => {
    const issues = issuesOf({ status: "OPEN", search: "x" });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe("unrecognized_keys");
    expect((issues[0] as { keys: string[] }).keys).toEqual([
      "status",
      "search",
    ]);
  });
});
