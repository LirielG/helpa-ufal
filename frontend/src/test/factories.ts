import type { LoginRequest, RegisterRequest, User } from "@/types";
import type { Action } from "@/features/dashboard/types";
import type { ActionDetail } from "@/features/action-detail/types";
import type { UserActivity } from "@/features/profile/types";

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

export function makeAction(overrides: Partial<Action> = {}): Action {
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
    details: {
      description: "Descrição da ação de teste.",
      area: "robotica",
      format: "IN_PERSON",
      url: null,
      workloadHours: 20,
    },
    ...overrides,
  };
}

export function makeActionDetail(
  overrides: Partial<ActionDetail> = {},
): ActionDetail {
  const { details, ...action } = makeAction();

  return {
    ...action,
    details: details && {
      ...details,
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

export function makeUserActivity(
  overrides: Partial<UserActivity> = {},
): UserActivity {
  return {
    id: unique("activity"),
    title: "Atividade de Teste",
    description: "Descrição da atividade de teste.",
    location: "Campus Arapiraca",
    date: "2026-03-10",
    status: "enrolled",
    workloadHours: 20,
    ...overrides,
  };
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
