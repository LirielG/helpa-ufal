import {
  UserType,
  ActivityType,
  CampusLocation,
  ActivityStatus,
  ActivityFormat,
} from "@prisma/client";
import bcryptjs from "bcryptjs";
import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";

async function main() {
  const {
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    ADMIN_FULL_NAME: adminFullName,
  } = env;

  if (!adminEmail || !adminPassword || !adminFullName) {
    throw new Error(
      "Missing required env vars: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME",
    );
  }

  const passwordHash = await bcryptjs.hash(adminPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: adminFullName,
      isManager: true,
      userType: UserType.TEACHER,
    },
    create: {
      fullName: adminFullName,
      email: adminEmail,
      passwordHash,
      userType: UserType.TEACHER,
      isManager: true,
    },
  });

  await prisma.teacher.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      registrationCode: "SIAPE123456",
      cndb: "CNDB123456",
      course: "Ciência da Computação",
    },
  });

  console.log(`✓ Admin user seeded: ${adminEmail}`);

  const addressArapiraca = await prisma.address.upsert({
    where: { id: "00000000-0000-4000-a000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000001",
      addressLine: "Av. Manoel Severino Silva, s/n - Campus Arapiraca",
      district: "Bom Sucesso",
      zipCode: "57309-005",
      city: "Arapiraca",
      state: "AL",
    },
  });

  const addressMaceio = await prisma.address.upsert({
    where: { id: "00000000-0000-4000-a000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000002",
      addressLine: "Av. Lourival Melo Mota, s/n - Campus A. C. Simões",
      district: "Cidade Universitária",
      zipCode: "57072-900",
      city: "Maceió",
      state: "AL",
    },
  });

  const nativeActivities = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Oficina de Programação Web e Python",
      type: ActivityType.COURSE,
      campus: CampusLocation.ARAPIRACA,
      startDate: new Date("2026-09-01T09:00:00.000Z"),
      endDate: new Date("2026-11-30T17:00:00.000Z"),
      slots: 30,
      status: ActivityStatus.OPEN,
      details: {
        description:
          "Ensinar fundamentos de lógica de programação, desenvolvimento web (HTML/CSS/JS) e introdução a Python para jovens de escolas públicas da região do Agreste alagoano.",
        area: "Tecnologia e Inovação",
        format: ActivityFormat.IN_PERSON,
        url: "https://helpa.ufal.br/cursos/python-web",
        workloadHours: 40,
        addressId: addressArapiraca.id,
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Aulas de Reforço em Matemática Básica",
      type: ActivityType.EXTENSION,
      campus: CampusLocation.ARAPIRACA,
      startDate: new Date("2026-09-05T14:00:00.000Z"),
      endDate: new Date("2026-12-10T16:00:00.000Z"),
      slots: 25,
      status: ActivityStatus.OPEN,
      details: {
        description:
          "Programa de nivelamento e monitoria em matemática básica e raciocínio lógico voltado a estudantes do ensino fundamental e médio.",
        area: "Educação",
        format: ActivityFormat.HYBRID,
        url: "https://helpa.ufal.br/projetos/reforco-matematica",
        workloadHours: 30,
        addressId: addressArapiraca.id,
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      title: "Hackathon e Mostra Tecnológica UFAL 2026",
      type: ActivityType.EVENT,
      campus: CampusLocation.MACEIO,
      startDate: new Date("2026-10-10T08:00:00.000Z"),
      endDate: new Date("2026-10-12T20:00:00.000Z"),
      slots: 100,
      status: ActivityStatus.OPEN,
      details: {
        description:
          "Maratona de inovação e desenvolvimento de protótipos focada em soluções para desafios comunitários e sustentabilidade universitária.",
        area: "Inovação e Tecnologia",
        format: ActivityFormat.IN_PERSON,
        url: "https://helpa.ufal.br/eventos/hackathon-2026",
        workloadHours: 24,
        addressId: addressMaceio.id,
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      title: "Ciclo de Palestras: Saúde Mental no Ambiente Acadêmico",
      type: ActivityType.LECTURE,
      campus: CampusLocation.MACEIO,
      startDate: new Date("2026-09-15T18:00:00.000Z"),
      endDate: new Date("2026-10-20T20:00:00.000Z"),
      slots: 150,
      status: ActivityStatus.OPEN,
      details: {
        description:
          "Encontros semanais online com profissionais de psicologia e saúde sobre estratégias de autocuidado, gerenciamento de estresse e bem-estar estudantil.",
        area: "Saúde e Bem-estar",
        format: ActivityFormat.ONLINE,
        url: "https://helpa.ufal.br/palestras/saude-mental",
        workloadHours: 12,
        addressId: null,
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000005",
      title: "Projeto Hortas Urbanas e Educação Ambiental",
      type: ActivityType.EXTENSION,
      campus: CampusLocation.PENEDO,
      startDate: new Date("2026-09-08T08:00:00.000Z"),
      endDate: new Date("2026-11-28T12:00:00.000Z"),
      slots: 20,
      status: ActivityStatus.OPEN,
      details: {
        description:
          "Oficinas práticas de compostagem, cultivo orgânico e conscientização ecológica junto à comunidade do Baixo São Francisco.",
        area: "Meio Ambiente e Sustentabilidade",
        format: ActivityFormat.IN_PERSON,
        url: null,
        workloadHours: 35,
        addressId: null,
      },
    },
  ];

  for (const act of nativeActivities) {
    const { details, ...activityData } = act;

    await prisma.activity.upsert({
      where: { id: act.id },
      update: {
        title: activityData.title,
        type: activityData.type,
        campus: activityData.campus,
        startDate: activityData.startDate,
        endDate: activityData.endDate,
        slots: activityData.slots,
        status: activityData.status,
      },
      create: {
        ...activityData,
        authorId: user.id,
      },
    });

    await prisma.activityDetails.upsert({
      where: { activityId: act.id },
      update: {
        description: details.description,
        area: details.area,
        format: details.format,
        url: details.url,
        workloadHours: details.workloadHours,
        addressId: details.addressId,
      },
      create: {
        activityId: act.id,
        description: details.description,
        area: details.area,
        format: details.format,
        url: details.url,
        workloadHours: details.workloadHours,
        addressId: details.addressId,
      },
    });

    console.log(`✓ Seeded activity: ${activityData.title}`);
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((err) => {
    console.error("Error during seed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
