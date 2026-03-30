import { z } from "zod";

/**
 * Optional string that treats empty strings as undefined.
 * Use for optional text fields where "" from forms should mean "not provided".
 */
export const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

/**
 * Optional string FK reference — empty strings become undefined to avoid
 * foreign key constraint violations from "" being treated as an ID.
 */
export const optionalFk = z
  .string()
  .optional()
  .transform((v) => (v === "" || !v ? undefined : v));

/**
 * Optional number that handles NaN and empty string from form inputs.
 * Converts NaN, empty string, and undefined to undefined before validation.
 */
export const optionalPositiveInt = z.preprocess(
  (v) =>
    v === "" || v === undefined || (typeof v === "number" && isNaN(v))
      ? undefined
      : v,
  z.number().int().positive().optional(),
);
