import type { ActionDetail } from "./types";
import { MOCK_ACTION_DETAILS } from "./constants";

/**
 * Fetches a single action by ID.
 * Currently backed by mock data with a simulated network delay.
 * Replace the body with a real fetch call when the API is ready.
 */
export async function getActionById(id: string): Promise<ActionDetail | null> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return MOCK_ACTION_DETAILS.find((a) => a.id === id) ?? null;
}

/**
 * Enrolls the authenticated user in an action.
 * Currently a mock that resolves successfully after a short delay.
 * Replace the body with a real fetch call when the API is ready.
 */
export async function enrollInAction(actionId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Uncomment to simulate a failure during development:
  // throw new Error("Erro ao realizar inscrição. Tente novamente.");
  void actionId;
}
