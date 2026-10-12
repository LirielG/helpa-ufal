import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/test/render";
import { makeUserActivity } from "@/test/factories";
import { ManagedCard } from "../ManagedCard";
import { EnrolledCard } from "../EnrolledCard";

describe("Profile Activity Cards", () => {
  describe("ManagedCard", () => {
    it("renders manage enrollments button and triggers callback on click", async () => {
      const activity = makeUserActivity({
        id: "act-1",
        title: "Oficina de Robótica",
        status: "managed",
      });
      const onEdit = vi.fn();
      const onManageEnrollments = vi.fn();

      const { user } = render(
        <ManagedCard
          activity={activity}
          onEdit={onEdit}
          onManageEnrollments={onManageEnrollments}
        />,
      );

      const manageButton = screen.getByRole("button", {
        name: "Gerenciar inscritos",
      });
      expect(manageButton).toBeInTheDocument();

      await user.click(manageButton);
      expect(onManageEnrollments).toHaveBeenCalledWith("act-1");
      expect(onEdit).not.toHaveBeenCalled();
    });

    it("keeps the edit button working next to the manage button", async () => {
      const activity = makeUserActivity({ id: "act-3", status: "managed" });
      const onEdit = vi.fn();
      const onManageEnrollments = vi.fn();

      const { user } = render(
        <ManagedCard
          activity={activity}
          onEdit={onEdit}
          onManageEnrollments={onManageEnrollments}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Editar atividade" }));

      expect(onEdit).toHaveBeenCalledWith("act-3");
      expect(onManageEnrollments).not.toHaveBeenCalled();
    });
  });

  describe("EnrolledCard", () => {
    it("does not render manage enrollments button for actions user did not create", () => {
      const activity = makeUserActivity({
        id: "act-2",
        title: "Plantio de Árvores",
        status: "enrolled",
      });

      render(<EnrolledCard activity={activity} />);

      expect(
        screen.queryByRole("button", { name: "Gerenciar inscritos" }),
      ).not.toBeInTheDocument();
    });
  });
});
