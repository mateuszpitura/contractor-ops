# Plugin fixture — `no-untranslated-toast.grit`

These fixtures double as documentation + a `scripts/test-biome-plugins.mjs`
harness input. Each example below is a stand-alone TS snippet; the harness
runs `biome check` over it and compares the diagnostic output to the
`expected` block below it.

## Reject — literal toast argument

```ts
// expect: warn
toast.success('Saved');
toast.error("Failed to save");
toast.info('Heads up');
toast.warning('Be careful');
```

## Allow — translated values

```ts
// expect: clean
toast.success(t('Foo.bar'));
toast.error(tKey(t, 'Errors.contractorNotFound'));
toast.info(translatedString);
toast.warning(`Hello ${name}`);
```
