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

export function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: unique("action"),
    title: "Ação de Teste",
    description: "Descrição da ação de teste.",
    image: "https://example.test/acao.png",
    location: "Campus Arapiraca",
    date: "2026-03-10",
    workload: 20,
    format: "presencial",
    spots: 30,
    cep: 57309005,
    city: "Arapiraca",
    state: "AL",
    type: "oficina",
    status: "available",
    area: "robotica",
    ...overrides,
  };
}

export function makeActionDetail(
  overrides: Partial<ActionDetail> = {},
): ActionDetail {
  return {
    id: unique("action-detail"),
    title: "Ação de Teste",
    shortDescription: "Resumo da ação de teste.",
    fullDescription: "Descrição completa da ação de teste.",
    bannerUrl: "https://example.test/banner.png",
    category: "Oficina",
    institution: "UFAL",
    city: "Arapiraca",
    venue: "Campus Arapiraca",
    startDate: "2026-03-10",
    endDate: "2026-03-17",
    schedule: "14h às 18h",
    workloadHours: 20,
    slots: 12,
    totalSlots: 30,
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
