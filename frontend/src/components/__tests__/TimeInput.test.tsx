import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test";
import { TimeInput } from "../TimeInput";
import { timeSchema } from "@/validators/time";

function Harness() {
  const [value, setValue] = useState("");
  return <TimeInput aria-label="Horário" value={value} onChange={setValue} />;
}

describe("TimeInput", () => {
  it("masks digits as 24h hh:mm", async () => {
    const { user } = render(<Harness />);

    await user.type(screen.getByLabelText("Horário"), "1830");

    expect(screen.getByLabelText("Horário")).toHaveValue("18:30");
  });

  it("pads a single-digit hour when the colon is typed", async () => {
    const { user } = render(<Harness />);

    await user.type(screen.getByLabelText("Horário"), "8:30");

    expect(screen.getByLabelText("Horário")).toHaveValue("08:30");
  });
});

describe("timeSchema", () => {
  const schema = timeSchema("Obrigatório");

  it.each(["00:00", "08:30", "23:59"])("accepts %s", (v) => {
    expect(schema.safeParse(v).success).toBe(true);
  });

  it.each(["8:3", "25:70", "24:00", "12:60", "1230"])("rejects %s", (v) => {
    const result = schema.safeParse(v);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "Informe um horário válido (hh:mm).",
    );
  });

  it("keeps the required message for an empty value", () => {
    expect(schema.safeParse("").error?.issues[0].message).toBe("Obrigatório");
  });
});
