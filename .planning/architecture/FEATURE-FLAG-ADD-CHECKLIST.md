# Feature flag add checklist

Use when introducing a new Unleash flag that gates product behavior.

## 1. Registry (code)

- [ ] Add key to `packages/feature-flags/src/registry.ts` (`Feature` enum + defaults)
- [ ] Document jurisdiction/default in registry comment if region-specific
- [ ] Never call Unleash SDK directly from apps — use `evaluate`, `useFlag`, `<Feature>`

## 2. Signoff

- [ ] Add entry to `.planning/signoff/feature-flags/*.json` if flag affects compliance/legal UX
- [ ] Link phase or ADR in signoff note when applicable

## 3. Unleash UI

- [ ] Create flag in self-hosted Unleash with matching key
- [ ] Set default strategy (off in prod until rollout plan exists)

## 4. Server middleware

- [ ] Gate tRPC procedures or REST routes via `evaluate()` in procedure middleware when server-enforced
- [ ] Cron/QStash jobs: evaluate at job entry, not only UI

## 5. Client UI

- [ ] `useFlag(Feature.X)` or `<Feature flag={Feature.X}>` in web-vite containers
- [ ] Ship loading/empty states when flag off (hide vs disabled — pick one per UX)

## 6. Verification

- [ ] Manual: flag on/off in dev Unleash
- [ ] `pnpm typecheck --filter=@contractor-ops/feature-flags`
- [ ] No raw `unleash` imports in `apps/*`
