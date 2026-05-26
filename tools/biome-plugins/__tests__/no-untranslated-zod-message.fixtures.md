# Plugin fixture — `no-untranslated-zod-message.grit`

## Reject — literal message on Zod chain

```ts
// expect: warn
z.string().min(1, { message: 'Required' });
z.string().max(50, { message: "Too long" });
z.string().email({ message: 'Bad email' });
z.string().refine(v => v.length > 0, { message: 'Refine failed' });
```

## Allow — key literal or wrapped helper

```ts
// expect: clean
z.string().min(1, { message: 'validation.required' });
z.string().refine(v => v, { message: tKey(t, 'validation.required') });
```
