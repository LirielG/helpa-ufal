import { Prisma } from "@prisma/client";

/**
 * Returns the field names of a unique-constraint violation (P2002), unquoted,
 * or null when the error is not one.
 *
 * Prisma's P2002 shape has changed across versions/engines:
 * - Legacy (Rust query engine): `meta.target` — a field name or array of
 *   field names (e.g. ["registrationCode"]).
 * - Driver adapters (e.g. @prisma/adapter-pg): the field names instead live
 *   nested at `meta.driverAdapterError.cause.constraint.fields`, as quoted SQL
 *   identifiers (e.g. ['"registrationCode"']).
 * Both shapes are read so this keeps working regardless of which one this
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
  const driverAdapterError = meta?.driverAdapterError as
    { cause?: { constraint?: { fields?: unknown } } } | undefined;

  const rawCandidates: unknown[] = [
    meta?.target,
    driverAdapterError?.cause?.constraint?.fields,
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
