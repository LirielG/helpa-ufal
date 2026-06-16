import type { ActionType } from "../dashboard/types";
import { ACTION_TYPES } from "../dashboard/constants";

export function toInputDate(value: string): string {
  const [day, month, year] = value.split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function fromInputDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export function categoryToActionType(category: string): ActionType {
  const normalized = category.trim().toLowerCase();
  const match = ACTION_TYPES.find((option) => option.value === normalized);
  return (match?.value ?? ACTION_TYPES[0].value) as ActionType;
}