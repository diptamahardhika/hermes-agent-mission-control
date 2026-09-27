/**
 * Narrow an `unknown` (usually a caught exception) to a usable shape without
 * scattering `as any` across the codebase.
 *
 * Error values are genuinely untyped at runtime: anything can be thrown, and
 * libs vary between `Error`, `{ message }`, `{ error }`, and plain strings.
 * These helpers read defensively so a handler never throws while reporting a
 * different throw.
 */

type MaybeRecord = Record<string, unknown>;

function asRecord(value: unknown): MaybeRecord | null {
  return typeof value === "object" && value !== null
    ? (value as MaybeRecord)
    : null;
}

/**
 * Best-effort human-readable message for an unknown thrown value.
 *
 * Checks, in order: a string/number/boolean value, `.message`, `.error`
 * (some libs nest it), then `String(value)`.
 */
export function errorMessage(value: unknown, fallback = "Unknown error"): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const rec = asRecord(value);
  if (rec) {
    if (typeof rec.message === "string" && rec.message) return rec.message;
    if (typeof rec.error === "string" && rec.error) return rec.error;
    const nested = asRecord(rec.error);
    if (nested && typeof nested.message === "string" && nested.message) {
      return nested.message;
    }
  }

  try {
    const str = String(value);
    return str && str !== "[object Object]" ? str : fallback;
  } catch {
    return fallback;
  }
}

/** The `.name` of a thrown value, when it has one. */
export function errorName(value: unknown): string | undefined {
  const rec = asRecord(value);
  if (rec && typeof rec.name === "string") return rec.name;
  return undefined;
}

/** The HTTP status a thrown value carries, when present (e.g. from a fetch lib). */
export function errorStatus(value: unknown): number | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  if (typeof rec.status === "number") return rec.status;
  if (typeof rec.statusCode === "number") return rec.statusCode;
  return undefined;
}

/** The `stdout` of a thrown value — used when shelling out to a CLI. */
export function errorStdout(value: unknown): string {
  const rec = asRecord(value);
  if (rec && typeof rec.stdout === "string") return rec.stdout;
  return "";
}
