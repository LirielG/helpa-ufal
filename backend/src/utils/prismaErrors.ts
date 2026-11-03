import { Prisma } from "@prisma/client";

// Prisma's default name for a unique index: `<Model>_<field>[_<field>...]_key`.
const DEFAULT_UNIQUE_INDEX = /^[^_]+_(.+)_key$/;

/**
 * Returns the field names of a unique-constraint violation (P2002), unquoted,
 * or null when the error is not one.
 *
 * Prisma's P2002 shape has changed across versions/engines:
 * - Legacy (Rust query engine): `meta.target` — a field name or array of
 *   field names (e.g. ["registrationCode"]).
 * - Driver adapters up to 7.8 (@prisma/adapter-pg): the field names live at
 *   `meta.driverAdapterError.cause.constraint.fields`, as quoted SQL
 *   identifiers (e.g. ['"registrationCode"']).
 * - Driver adapters from 7.10: only the index name is reported, at
 *   `meta.driverAdapterError.cause.constraint.index`
 *   (e.g. "Student_registrationCode_key"). The fields are taken from Prisma's
 *   default index name; an index with a custom name yields no fields.
 * All shapes are read so this keeps working regardless of which one this
 * project's Prisma setup produces.
 */
export function uniqueViolationFields(err: unknown): string[] | null {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return null;
  }

  const meta = err.meta as Record<string, unknown> | undefined;
  const constraint = (
    meta?.driverAdapterError as
      | { cause?: { constraint?: { fields?: unknown; index?: unknown } } }
      | undefined
  )?.cause?.constraint;

  const rawCandidates: unknown[] = [
    meta?.target,
    constraint?.fields,
    fieldsFromIndexName(constraint?.index),
  ];

  return rawCandidates
    .flatMap((candidate) => {
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (item): item is string => typeof item === "string",
        );
      }
      return typeof candidate === "string" ? [candidate] : [];
    })
    .map((field) => field.replaceAll('"', ""));
}

function fieldsFromIndexName(index: unknown): string[] {
  if (typeof index !== "string") return [];
  const match = DEFAULT_UNIQUE_INDEX.exec(index);
  return match ? match[1].split("_") : [];
}
