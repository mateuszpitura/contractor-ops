# Plugin fixture — `no-untranslated-trpc-error.grit`

## Reject — literal message

```ts
// expect: warn
throw new TRPCError({ code: 'NOT_FOUND', message: 'Contractor missing' });
throw new TRPCError({ code: 'BAD_REQUEST', message: "Invalid input" });
```

## Allow — errors.ts constant reference

```ts
// expect: clean
throw new TRPCError({ code: 'NOT_FOUND', message: CONTRACTOR_NOT_FOUND });
throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
```
