import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeInput } from "../TimeInput";
import { maskTime } from "../../utils/dateField";
import { timeSchema } from "@/validators/time";

function Harness() {
  const [value, setValue] = useState("");
  return <TimeInput aria-label="Horário" value={value} onChange={setValue} />;
}

describe("TimeInput", () => {
  it("masks digits as 24h hh:mm", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText("Horário"), "1830");

    expect(screen.getByLabelText("Horário")).toHaveValue("18:30");
  });

  it("drops anything that is not a digit and caps the length", () => {
    expect(maskTime("ab1:2c3 45 6")).toBe("12:34");
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
