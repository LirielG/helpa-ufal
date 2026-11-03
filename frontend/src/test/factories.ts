import type { LoginRequest, RegisterRequest, User } from "@/types";
import type { Activity, ActivityListItem } from "@/services/contracts/activity";
import type {
  EnrollmentListItem,
  EnrollmentUser,
} from "@/services/contracts/enrollment";
import type { UserActivityItem } from "@/services/contracts/user";
import type { CertificateValidation } from "@/services/contracts/certificate";
import type {
  Report,
  ReportActivity,
  ReportReporter,
} from "@/services/contracts/report";
import type { UserActivity } from "@/features/profile/types";
import type { SigaaActivity } from "@/features/sigaa/types";

let counter = 0;

/** Monotonic suffix so ids and e-mails never collide inside one run. */
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Reset between tests so ids stay stable and readable. Called by setup.ts. */
export function resetFactoryCounter(): void {
  counter = 0;
}

const NOW = "2026-01-01T12:00:00.000Z";

export function makeUser(overrides: Partial<User> = {}): User {
  const id = unique("user");

  return {
    id,
    email: `${id}@ufal.br`,
    fullName: "Usuário de Teste",
    userType: "STUDENT",
    isManager: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Shorthand for a teacher with manager privileges. */
export function makeManager(overrides: Partial<User> = {}): User {
  return makeUser({ userType: "TEACHER", isManager: true, ...overrides });
}

const ACTION_START = "2026-03-10T14:00:00.000Z";
const ACTION_END = "2026-03-17T18:00:00.000Z";

/** Private defaults both activity factories build on, so the two stay independent. */
function makeActivityHeader(): Omit<Activity, "details"> {
  return {
    id: unique("action"),
    authorId: unique("author"),
    title: "Oficina de Programação",
    type: "COURSE",
    campus: "ARAPIRACA",
    startDate: ACTION_START,
    endDate: ACTION_END,
    slots: 30,
    availableSlots: 12,
    status: "OPEN",
  };
}

export function makeAction(
  overrides: Partial<ActivityListItem> = {},
): ActivityListItem {
  const header = makeActivityHeader();

  return {
    ...header,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    details: {
      activityId: header.id,
      description: "Descrição da ação de teste.",
      area: "robotica",
      format: "IN_PERSON",
      url: null,
      workloadHours: 20,
      addressId: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    ...overrides,
  };
}

export function makeActionDetail(overrides: Partial<Activity> = {}): Activity {
  return {
    ...makeActivityHeader(),
    details: {
      description: "Descrição da ação de teste.",
      area: "robotica",
      format: "IN_PERSON",
      url: null,
      workloadHours: 20,
      address: {
        id: unique("address"),
        addressLine: "Av. Manoel Severino Barbosa, s/n",
        district: "Bom Sucesso",
        zipCode: "57309005",
        city: "Arapiraca",
        state: "AL",
      },
    },
    ...overrides,
  };
}

export function makeSigaaActivity(
  overrides: Partial<SigaaActivity> = {},
): SigaaActivity {
  counter += 1;

  return {
    id: unique("sigaa"),
    sigaaId: String(13700 + counter),
    title: "I Ciclo de Debates sobre Currículos",
    type: "CURSO",
    normalizedType: "COURSE",
    department: "Instituto de Computação",
    lastSeenAt: NOW,
    ...overrides,
  };
}

/**
 * Item of GET /users/me/activities: an approved enrollment of the signed-in
 * user in an OPEN action, with no certificate yet.
 */
export function makeUserActivityItem(
  overrides: Partial<UserActivityItem> = {},
): UserActivityItem {
  const action = { ...makeActionDetail(), ...overrides };

  return {
    ...action,
    enrollment: {
      id: unique("enrollment"),
      activityId: action.id,
      userId: unique("user"),
      status: "APPROVED",
      attendanceConfirmed: null,
      confirmedWorkloadHours: 0,
      createdAt: NOW,
      updatedAt: NOW,
    },
    certificate: null,
    ...overrides,
  };
}

/** A card of the profile's "Ações" tab; `action` overrides reach the action itself. */
export function makeUserActivity(
  overrides: Partial<Omit<UserActivity, "action">> & {
    action?: Partial<Activity>;
  } = {},
): UserActivity {
  const { action, ...rest } = overrides;

  return {
    action: makeActionDetail({ title: "Atividade de Teste", ...action }),
    description: "Descrição da atividade de teste.",
    location: "Campus Arapiraca",
    date: "2026-03-10",
    certificate: null,
    confirmedWorkloadHours: 0,
    ...rest,
  };
}

/** An action the signed-in user manages, as listed in the "managed" sub-tab. */
export function makeManagedActivity(
  overrides: Parameters<typeof makeUserActivity>[0] = {},
): UserActivity {
  return makeUserActivity({
    ...overrides,
    action: {
      title: "Campanha de Arrecadação de Agasalhos",
      ...overrides.action,
    },
  });
}

export const DEFAULT_PASSWORD = "Senha@123";

export function makeLoginRequest(
  overrides: Partial<LoginRequest> = {},
): LoginRequest {
  return {
    email: `${unique("user")}@ufal.br`,
    password: DEFAULT_PASSWORD,
    ...overrides,
  };
}

export function makeRegisterRequest(
  overrides: Partial<RegisterRequest> = {},
): RegisterRequest {
  return {
    fullName: "Usuário de Teste",
    email: `${unique("user")}@ufal.br`,
    password: DEFAULT_PASSWORD,
    confirmPassword: DEFAULT_PASSWORD,
    userType: "STUDENT",
    course: "Ciência da Computação",
    registrationCode: unique("mat"),
    ...overrides,
  };
}

/**
 * Factory for items of GET /activities/:id/enrollments.
 *
 * Default values have attendanceConfirmed as null and confirmedWorkloadHours as 0
 * — the structural "nothing recorded yet" state, not an error.
 */
export function makeEnrollment(
  overrides: Partial<Omit<EnrollmentListItem, "user">> & {
    user?: Partial<EnrollmentUser>;
  } = {},
): EnrollmentListItem {
  const { user, ...rest } = overrides;
  const userId = user?.id ?? rest.userId ?? unique("user");

  return {
    id: unique("enrollment"),
    activityId: unique("activity"),
    userId,
    status: "APPROVED",
    attendanceConfirmed: null,
    confirmedWorkloadHours: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...rest,
    user: {
      id: userId,
      fullName: "Voluntário de Teste",
      email: `${unique("vol")}@ufal.br`,
      registrationCode: unique("mat"),
      ...user,
    },
  };
}

/** Response of GET /certificate-validations/:validationCode, as in the Bruno example. */
export function makeCertificateValidation(
  overrides: Partial<CertificateValidation> = {},
): CertificateValidation {
  return {
    validationCode: "7KQ4MX9T2R",
    holderName: "Maria Silva Souza",
    activityTitle: "Semana da Computação — Oficina de Git",
    activityStartDate: "2026-06-10T13:00:00.000Z",
    activityEndDate: "2026-06-12T15:00:00.000Z",
    workloadHours: 8,
    issuedAt: "2026-06-15T12:00:00.000Z",
    ...overrides,
  };
}

/** Item of GET /reports and response of PUT /reports/:reportId/resolution. */
export function makeReport(
  overrides: Partial<Omit<Report, "activity" | "reporter">> & {
    activity?: Partial<ReportActivity>;
    reporter?: Partial<ReportReporter> | null;
  } = {},
): Report {
  const { activity, reporter, ...rest } = overrides;

  return {
    id: unique("report"),
    category: "MISINFORMATION",
    description: "O endereço informado na descrição não confere.",
    createdAt: "2026-06-05T19:44:20.000Z",
    resolvedAt: null,
    ...rest,
    activity: {
      id: unique("activity"),
      title: "Oficina de Introdução à Programação",
      authorId: unique("author"),
      ...activity,
    },
    reporter:
      reporter === null
        ? null
        : {
            id: unique("reporter"),
            fullName: "Maria Clara Santos",
            ...reporter,
          },
  };
}

/**
 * A `YYYY-MM-DD` value for date inputs, `daysAhead` days from now. Forms that
 * reject past dates need this instead of a fixed date, which expires.
 */
export function futureDateInput(daysAhead = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split("T")[0];
}
