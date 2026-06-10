import { TRPCError } from '@trpc/server';

/**
 * Minimal structural view of a Zod schema. Declared locally so the REST layer
 * does not take a direct dependency on `zod` (it is owned by
 * `@contractor-ops/validators`, which exports the schemas consumed here). The
 * parsed output type is inferred from the schema's own `safeParse` result, so
 * callers keep full type safety on the returned input.
 */
type SafeParsableSchema = {
  safeParse: (
    input: unknown,
  ) => { success: true; data: unknown } | { success: false; error: { issues: unknown } };
};

type ParsedOutput<TSchema extends SafeParsableSchema> = Extract<
  ReturnType<TSchema['safeParse']>,
  { success: true }
>['data'];

/**
 * Validates raw Hono query params against a list-input schema at the REST
 * boundary, returning the parsed (coerced, defaulted) input for the tRPC caller.
 *
 * Untrusted query strings are never cast with `as` — an unknown enum value or a
 * malformed page number is rejected here with a `BAD_REQUEST`, which the shared
 * `handleError` maps to a clean 400 (`VALIDATION_ERROR`) instead of surfacing an
 * opaque downstream error. Valid input behaves identically to passing the schema
 * directly to the procedure (same coercion and defaults).
 */
export function parseListQuery<TSchema extends SafeParsableSchema>(
  schema: TSchema,
  query: Record<string, string | undefined>,
): ParsedOutput<TSchema> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: JSON.stringify({ validation: result.error.issues }),
    });
  }
  return result.data as ParsedOutput<TSchema>;
}
