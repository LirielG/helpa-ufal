import { describe, it, expect } from "vitest";
import { ConfirmAttendanceBodySchema } from "../EnrollmentSchemas.js";

function issuesOf(body: Record<string, unknown>) {
  const result = ConfirmAttendanceBodySchema.safeParse(body);
  expect(result.success).toBe(false);
  return result.error!.issues.map(({ path, message }) => ({ path, message }));
}

describe("ConfirmAttendanceBodySchema", () => {
  // ---------- Valid bodies ----------

  it("parses a presence with its hours", () => {
    expect(
      ConfirmAttendanceBodySchema.parse({ attended: true, workloadHours: 4 }),
    ).toEqual({ attended: true, workloadHours: 4 });
  });

  it("parses an absence without hours", () => {
    expect(ConfirmAttendanceBodySchema.parse({ attended: false })).toEqual({
      attended: false,
    });
  });

  it("lets fractional and out-of-range hours through — the service answers 422 for them", () => {
    expect(
      ConfirmAttendanceBodySchema.parse({ attended: true, workloadHours: 4.5 }),
    ).toEqual({ attended: true, workloadHours: 4.5 });
    expect(
      ConfirmAttendanceBodySchema.parse({ attended: true, workloadHours: 0 }),
    ).toEqual({ attended: true, workloadHours: 0 });
  });

  // ---------- Cross-field rules ----------

  it("rejects workloadHours sent together with attended=false", () => {
    expect(issuesOf({ attended: false, workloadHours: 4 })).toEqual([
      {
        path: ["workloadHours"],
        message: "workloadHours must be omitted when attended is false.",
      },
    ]);
  });

  it("rejects attended=true without workloadHours — (true, 0) is not a valid state", () => {
    expect(issuesOf({ attended: true })).toEqual([
      {
        path: ["workloadHours"],
        message: "workloadHours is required when attended is true.",
      },
    ]);
  });
});
