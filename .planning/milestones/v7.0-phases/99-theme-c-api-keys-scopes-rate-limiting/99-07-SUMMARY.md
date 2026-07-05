# 99-07 SUMMARY — Settings → Developer surface

**Wave:** 4 · **Status:** done

## What landed

### Backend read-only queries (Task 1)
- `apiKeyRouter.ipLog(id)` — recent `ApiKeyIpEvent` rows for a key (org-scoped, `seenAt` desc, capped 50).
- `apiKeyRouter.usage()` — `{ month, count, quota }` (current-month request count from a new read-only
  `getMonthlyRequestCount`; quota from `TIER_MONTHLY_REQUEST_QUOTA[tier]`, null for unlimited/Enterprise).
- Both under `apiKeyAdminProcedure` (organization:update + ENTERPRISE).

### Developer UI (Task 2)
- Hook `use-api-keys-tab.ts` gains `useRotateKeyDialog` (rotate + grace selector + one-time reveal) and
  `useKeyDetail` (ipLog + usage + members via `user.list` + a rebind mutation) — the ONLY tRPC boundary.
- `rotate-api-key-dialog.tsx` — grace-period selector (1/24/72/168h; default 24h, matching 99-05's clamp),
  an explanation of the grace window, a one-time new-key reveal with copy + "Done", and a security notice.
- `api-keys/key-detail-drawer.tsx` — scope visualization (granular scopes grouped read/write per resource),
  the acting-user binding (view + rebind to an active member; the server re-validates membership),
  monthly usage vs quota (progress bar / unlimited), and the source-IP log — each with
  loading / empty / error states, keyboard-accessible, RTL-safe.
- `data-table.tsx` — the existing last-used column plus View-details + Rotate actions in the active-key
  menu (revoked/expired keys stay actionless).

### i18n
- New `Settings.apiKeys` keys (rotate + detail + toasts) added to `en`, `de`, `pl`, `ar` (parity; `en-US`
  is a sparse US-only override that inherits `en`). Native-quality de/pl/ar polish is deferred
  (EXTERNAL-ENABLEMENT #9). Generated i18n types regenerated (gitignored artifact).

## Tests (GREEN)
- `api-keys-tab.test.tsx` — new-surface actions (View details + Rotate) render on an active key; last-used
  column renders; revoked keys stay actionless.
- `key-detail-drawer.test.tsx` (new) — scope groups (read/write), usage progressbar, source-IP rows, and
  the empty + error states for the ip-log / usage / members queries.

## Verification
- `pnpm typecheck --filter @contractor-ops/api --filter @contractor-ops/web-vite` clean (only the
  pre-existing Phase-92 `team-calendar` scaffold error remains — not this stream's).
- `pnpm check:web-vite-data-layer` + `check:web-vite-dialog-pattern` OK (hook is the only tRPC boundary;
  DialogBody/DialogFooter convention followed).
