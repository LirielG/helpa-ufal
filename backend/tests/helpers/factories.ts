import { randomUUID } from "node:crypto";
import bcryptjs from "bcryptjs";
import type {
  Activity,
  ActivityDetails,
  ActivityFormat,
  ActivityStatus,
  ActivityType,
  Address,
  CampusLocation,
  Enrollment,
  User,
} from "@prisma/client";
import { prisma } from "@/database/prisma.js";
import { signToken } from "./auth.js";
import { daysFromNow } from "./dates.js";
import { EnrollmentStatus } from "@/types/enrollment.js";

export const DEFAULT_PASSWORD = "Senha@123";

const DEFAULT_PASSWORD_HASH = bcryptjs.hashSync(DEFAULT_PASSWORD, 4);

function unique(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export type AuthenticatedFixture = { user: User; token: string };

type UserOverrides = Partial<
  Pick<User, "fullName" | "email" | "passwordHash" | "isManager">
> & { password?: string };

async function buildUserData(overrides: UserOverrides) {
  const { password, ...rest } = overrides;

  return {
    fullName: "Usuário de Teste",
    email: `${unique("user")}@ufal.br`,
    passwordHash: password
      ? await bcryptjs.hash(password, 4)
      : DEFAULT_PASSWORD_HASH,
    isManager: false,
    ...rest,
  };
}

export async function createStudent(
  overrides: UserOverrides &
    Partial<{ course: string; registrationCode: string }> = {},
): Promise<AuthenticatedFixture> {
  const { course, registrationCode, ...userOverrides } = overrides;

  const user = await prisma.user.create({
    data: {
      ...(await buildUserData(userOverrides)),
      userType: "STUDENT",
      student: {
        create: {
          registrationCode: registrationCode ?? unique("mat"),
          course: course ?? "Ciência da Computação",
        },
      },
    },
  });

  return {
    user,
    token: signToken({
      id: user.id,
      userType: "STUDENT",
      isManager: user.isManager,
    }),
  };
}

export async function createTeacher(
  overrides: UserOverrides &
    Partial<{ course: string; registrationCode: string; cndb: string }> = {},
): Promise<AuthenticatedFixture> {
  const { course, registrationCode, cndb, ...userOverrides } = overrides;

  const user = await prisma.user.create({
    data: {
      ...(await buildUserData(userOverrides)),
      userType: "TEACHER",
      teacher: {
        create: {
          registrationCode: registrationCode ?? unique("siape"),
          cndb: cndb ?? unique("cndb"),
          course: course ?? "Ciência da Computação",
        },
      },
    },
  });

  return {
    user,
    token: signToken({
      id: user.id,
      userType: "TEACHER",
      isManager: user.isManager,
    }),
  };
}

/** Shorthand for a user with manager privileges. */
export async function createManager(
  overrides: Parameters<typeof createTeacher>[0] = {},
): Promise<AuthenticatedFixture> {
  return createTeacher({ ...overrides, isManager: true });
}

export type ActivityFixture = Activity & {
  details: ActivityDetails & { address: Address | null };
};

type ActivityOverrides = Partial<{
  title: string;
  type: ActivityType;
  campus: CampusLocation;
  startDate: Date;
  endDate: Date;
  slots: number;
  status: ActivityStatus;
  description: string;
  area: string;
  format: ActivityFormat;
  url: string | null;
  workloadHours: number;
  address: Omit<Address, "id" | "createdAt" | "updatedAt"> | null;
}>;

/**
 * Creates an Activity with its ActivityDetails (and an Address, if asked for).
 * `authorId` must be the id of an existing User (call createTeacher() first
 * and pass `author.user.id`).
 */
export async function createActivity(
  authorId: string,
  overrides: ActivityOverrides = {},
): Promise<ActivityFixture> {
  const {
    description,
    area,
    format,
    url,
    workloadHours,
    address,
    ...activityOverrides
  } = overrides;

  const createdAddress = address
    ? await prisma.address.create({ data: address })
    : null;

  return prisma.activity.create({
    data: {
      authorId,
      title: "Atividade de Teste",
      type: "COURSE",
      campus: "ARAPIRACA",
      startDate: daysFromNow(7),
      endDate: daysFromNow(14),
      slots: 30,
      status: "OPEN",
      ...activityOverrides,
      details: {
        create: {
          description: description ?? "Descrição da atividade de teste.",
          area: area ?? "Tecnologia",
          format: format ?? "IN_PERSON",
          url: url ?? null,
          workloadHours: workloadHours ?? 20,
          addressId: createdAddress?.id ?? null,
        },
      },
    },
    include: { details: { include: { address: true } } },
  }) as Promise<ActivityFixture>;
}

export function anAddress(): Omit<Address, "id" | "createdAt" | "updatedAt"> {
  return {
    addressLine: "Av. Manoel Severino Barbosa, 100",
    district: "Bom Sucesso",
    zipCode: "57309-005",
    city: "Arapiraca",
    state: "AL",
  };
}


type EnrollmentOverrides = Partial<{
  status: EnrollmentStatus;
  attendanceConfirmed: boolean | null;
  confirmedWorkloadHours: number;
  isModerator: boolean;
  enrolledAt: Date;
}>;

/**
 * Creates an Enrollment directly in the database, bypassing the service.
 * Used to set up states the API doesn't expose (CANCELLED, PENDING).
 */
export async function createEnrollment(
  userId: string,
  activityId: string,
  overrides: EnrollmentOverrides = {},
): Promise<Enrollment> {
  return prisma.enrollment.create({
    data: {
      userId,
      activityId,
      status: "APPROVED",
      ...overrides,
    },
  });
}