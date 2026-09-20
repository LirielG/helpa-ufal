/**
 * Density of a form control. "md" is the app default; "sm" is the compact
 * density the action forms are drawn with, where two fields share a row.
 */
export type FieldSize = "sm" | "md";

/**
 * The compact label, shared by Input and Select so a form that mixes the two
 * keeps one label style.
 */
export const COMPACT_FIELD_LABEL = "text-sm font-semibold text-gray-700";
