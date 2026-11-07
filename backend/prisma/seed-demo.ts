import dotenv from "dotenv";
import {
  ActivityFormat,
  ActivityStatus,
  ActivityType,
  CampusLocation,
} from "@prisma/client";

if (process.env["NODE_ENV"]) {
  dotenv.config({ path: `.env.${process.env["NODE_ENV"]}`, quiet: true });
}

dotenv.config({ path: ".env", quiet: true });

if (process.env["NODE_ENV"] === "production") {
  console.error("Error: Demo seed cannot be run with NODE_ENV=production.");
  process.exit(1);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MS_PER_DAY);
}

async function main() {
  const { prisma } = await import("../src/database/prisma.js");
  const { seedAdmin } = await import("./seed.js");

  try {
    const user = await seedAdmin();

    const addressArapiraca = await prisma.address.upsert({
      where: { id: "00000000-0000-4000-a000-000000000001" },
      update: {
        zipCode: "57309005",
      },
      create: {
        id: "00000000-0000-4000-a000-000000000001",
        addressLine: "Av. Manoel Severino Silva, s/n - Campus Arapiraca",
        district: "Bom Sucesso",
        zipCode: "57309005",
        city: "Arapiraca",
        state: "AL",
      },
    });

    const addressMaceio = await prisma.address.upsert({
      where: { id: "00000000-0000-4000-a000-000000000002" },
      update: {
        zipCode: "57072900",
      },
      create: {
        id: "00000000-0000-4000-a000-000000000002",
        addressLine: "Av. Lourival Melo Mota, s/n - Campus A. C. Simões",
        district: "Cidade Universitária",
        zipCode: "57072900",
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
        startDate: daysFromNow(7),
        endDate: daysFromNow(97),
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
        startDate: daysFromNow(10),
        endDate: daysFromNow(100),
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
        startDate: daysFromNow(14),
        endDate: daysFromNow(16),
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
        startDate: daysFromNow(21),
        endDate: daysFromNow(56),
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
        startDate: daysFromNow(30),
        endDate: daysFromNow(110),
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

    console.log("Demo seeding completed successfully!");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Error during demo seed:", err);
  process.exit(1);
});
