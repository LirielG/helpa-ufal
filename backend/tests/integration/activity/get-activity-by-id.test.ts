import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "@/app.js";
import {
  createTeacher,
  createStudent,
  createActivity,
  createEnrollment,
  anAddress,
} from "../../helpers/factories.js";

describe("GET /activities/:id", () => {
  it("returns 200 with the full activity detail, including address", async () => {
    const author = await createTeacher();
    const address = anAddress();

    const activity = await createActivity(author.user.id, {
      title: "Oficina de Introdução à Programação",
      type: "COURSE",
      campus: "ARAPIRACA",
      slots: 40,
      status: "OPEN",
      format: "HYBRID",
      url: "https://meet.example.com/oficina",
      workloadHours: 20,
      area: "Tecnologia",
      description: "Introdução à lógica de programação para iniciantes.",
      address,
    });

    const response = await request(app).get(`/activities/${activity.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: activity.id,
      authorId: author.user.id,
      title: "Oficina de Introdução à Programação",
      type: "COURSE",
      campus: "ARAPIRACA",
      slots: 40,
      status: "OPEN",
      details: {
        description: "Introdução à lógica de programação para iniciantes.",
        area: "Tecnologia",
        format: "HYBRID",
        url: "https://meet.example.com/oficina",
        workloadHours: 20,
        address: {
          addressLine: address.addressLine,
          district: address.district,
          zipCode: address.zipCode,
          city: address.city,
          state: address.state,
        },
      },
    });
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("computes availableSlots correctly with APPROVED enrollments", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10, status: "OPEN" });

    const student1 = await createStudent();
    const student2 = await createStudent();
    const student3 = await createStudent();

    await createEnrollment(student1.user.id, activity.id, { status: "APPROVED" });
    await createEnrollment(student2.user.id, activity.id, { status: "APPROVED" });
    await createEnrollment(student3.user.id, activity.id, { status: "REJECTED" });

    const response = await request(app).get(`/activities/${activity.id}`);

    expect(response.status).toBe(200);
    expect(response.body.availableSlots).toBe(8);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    // Confirmado em ActivityService.findById: ValidationError com field "id".
    const response = await request(app).get("/activities/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "id", message: "id must be a valid UUID." },
    ]);
  });

  it("returns 404 when the UUID does not exist", async () => {
    const response = await request(app).get(`/activities/${randomUUID()}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "OPEN",
      deletedAt: new Date(),
    });

    const response = await request(app).get(`/activities/${activity.id}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 404, message: "Activity not found." });
  });
});
