# Weryfikacja integracji w kodzie — raport

**Data:** 2026-04-11  
**Zakres:** mechanizmy wspólne, KSeF (ścieżka referencyjna), webhooks + OAuth, cykl życia sekretów, RBAC, luki audytu.

---

## 1. Inwentaryzacja routerów tRPC

Źródło: [`packages/api/src/root.ts`](../../packages/api/src/root.ts).

| Router | Powiązanie z integracjami |
|--------|---------------------------|
| `integration` | Slack, OAuth URL, `disconnectGeneric`, health, sync/webhook logi |
| `ksef` | KSeF connect/disconnect/sync/historia/status |
| `peppol` | Peppol ASP, participant, QStash poll |
| `jira` | Jira Cloud — connect, mapowanie, disconnect |
| `linear` | Linear — status, mapowanie, webhooks (rejestracja w serwisie) |
| `calendar` | Połączenia osobiste Google/Outlook |
| `googleWorkspace` | Directory, import, sync |
| `teams` | Microsoft Teams — kanały, mapowanie |
| `billing` | Stripe (subskrypcja) |
| `esign` | DocuSign / Autenti |
| `onboardingImport` | Import z zewnętrznych narzędzi |
| `einvoice` | Statusy compliance per kraj (read-model) |
| `exchangeRate` | ECB (cron) |
| `audit` | Lista `AuditLog` (nie zapis integracji) |

Pozostałe routery (invoice, workflow, equipment, …) korzystają z integracji pośrednio (np. powiadomienia), ale nie są „routerami providera”.

---

## 2. Inwentaryzacja tras API (`apps/web/src/app/api`)

| Trasa | Rola |
|-------|------|
| `ksef/_sync` | QStash → `processKsefSync` (podpis Upstash) |
| `peppol/poll`, `peppol/inbound`, `peppol/outbound` | Peppol async / kierunki |
| `google-workspace/_sync` | QStash sync GWS |
| `webhooks/[provider]` | Unified ingress: weryfikacja podpisu adaptera → `WebhookDelivery` → QStash `_process` |
| `webhooks/_process` | QStash: `adapter.handleWebhook` + dispatch Jira/Linear/eSign |
| `webhooks/stripe` | Billing (osobna ścieżka) |
| `webhooks/inpost` | Kurier InPost |
| `oauth/[provider]/callback` | OAuth: `verifyOAuthState` → `storeCredentials` → upsert `IntegrationConnection` |
| `cron/token-refresh` | Odświeżanie tokenów |
| `cron/inpost-status-poll`, `data-purge`, … | Operacje wsadowe |

---

## 3. Checklist warstw wspólnych

### 3.1 Tenant i izolacja

| Werdykt | Uwagi |
|---------|--------|
| **PASS z zastrzeżeniem** | Procedury użytkownika idą przez `tenantProcedure` → `ctx.organizationId`. Routery integracji (np. [`ksef.ts`](../../packages/api/src/routers/ksef.ts)) używają globalnego `prisma` z filtrem `organizationId` — spójne z wzorcem w repo; [`tenant.ts`](../../packages/api/src/middleware/tenant.ts) ustawia też `ctx.db` (regionalny klient). Warto świadomie ustalić, czy wszystkie zapytania do danych org powinny przejść na `ctx.db` dla pełnej spójności z RLS/rozszerzeniami. |

### 3.2 RBAC (serwer vs `roles.ts` vs UI)

| Werdykt | Uwagi |
|---------|--------|
| **PASS** | [`rbac.ts`](../../packages/api/src/middleware/rbac.ts) deleguje do `auth.api.hasPermission`. Integracje typu KSeF/Peppol/Jira używają `settings: ["read" \| "update"]`. [`disconnectGeneric`](../../packages/api/src/routers/integration.ts) używa `organization: ["update"]` — **inne** uprawnienie niż KSeF: owner/admin mają oba; `it_admin` ma `settings` + `integration`, **nie** ma `organization.update`, więc **nie** odłączy przez `disconnectGeneric`, ale **może** KSeF przez `settings.update` — zamierzony podział (IT zarządza ustawieniami integracji, nie kasuje organizacji). Parity UI: [`use-permissions-parity.test.ts`](../../apps/web/src/hooks/__tests__/use-permissions-parity.test.ts). |

### 3.3 Cykl życia sekretów (`storeCredentials` / `deleteCredentials`)

| Werdykt | Uwagi |
|---------|--------|
| **PASS (po naprawie)** | KSeF, Peppol, Jira oraz **kalendarz** (Google/Outlook) wywołują `deleteCredentials` i zerują `credentialsRef` przy disconnect (wspólnie ze Slack / `disconnectGeneric`). |

### 3.4 Logi operacji (`IntegrationSyncLog`, `WebhookDelivery`)

| Werdykt | Uwagi |
|---------|--------|
| **PASS** | KSeF orchestrator zapisuje pełny cykl sync ([`ksef-sync-orchestrator.ts`](../../packages/api/src/services/ksef-sync-orchestrator.ts)). Webhooki: create + update `PROCESSED`/`FAILED` w [`webhooks/_process`](../../apps/web/src/app/api/webhooks/_process/route.ts). **Slack:** rozwiązywanie org po `teamId` w ingress (§11). **Jira/Linear:** odrzucenie w `_process`, jeśli org nadal pusty. |

### 3.5 `AuditLog` (immutable) vs logi integracji

| Werdykt | Uwagi |
|---------|--------|
| **PASS (częściowo)** | Dodano wpisy przy KSeF connect/disconnect, Peppol connect/disconnect, Jira disconnect, **kalendarz disconnect**, OAuth (`integration.oauth.connected`), **`disconnectGeneric`** / dedykowany **Slack disconnect** (§11). |

---

## 4. Deep dive: KSeF (end-to-end)

| Krok | Plik | Werdykt |
|------|------|---------|
| Connect | [`ksef.ts`](../../packages/api/src/routers/ksef.ts) | Token: `verifyCredentials` przed zapisem. Certyfikat: **`BAD_REQUEST`** (ścieżka niezaimplementowana w kliencie API). |
| Sync cron | [`ksef/_sync/route.ts`](../../apps/web/src/app/api/ksef/_sync/route.ts) | Tylko podpis QStash; body `{ organizationId, connectionId }`. |
| Orchestrator | [`ksef-sync-orchestrator.ts`](../../packages/api/src/services/ksef-sync-orchestrator.ts) | Sprawdzenie `connection.organizationId === organizationId`. `parseFa3Xml` → `mapKsefToInvoiceFields` → `invoice.create` + linie, duplikaty, `runAutoMatch`. |
| Mapowanie | [`mapper.ts`](../../packages/einvoice/src/profiles/ksef/mapper.ts) | Pola zgodne z modelem Invoice; `dueDate` opcjonalne w mapie — orchestrator ustawia fallback +14 dni. |
| Sync log częściowe błędy | Ten sam orchestrator | Przy `errors.length > 0`: `IntegrationSyncLog.status = FAILED`, `errorMessage` + pełny payload w `responsePayloadJson`. |

---

## 5. Deep dive: Webhooks + OAuth

### 5.1 Webhook ingress

- Podpis per adapter przed zapisem (`401` przy invalid).
- Zapis `WebhookDelivery`, kolejka QStash, `_process` z podpisem QStash.
- Jira/Linear: delegacja do handlerów API (unikanie cykli zależności).

**Werdykt:** **PASS** dla łańcucha weryfikacji i trwałości. **I6:** Slack — rozwiązanie org w [`webhooks/[provider]`](../../apps/web/src/app/api/webhooks/[provider]/route.ts) (§11); Jira/Linear — ochrona w [`_process`](../../apps/web/src/app/api/webhooks/_process/route.ts). Resend (Svix) nadal może mieć pusty org, jeśli nie da się wyciągnąć domeny z maila.

### 5.2 OAuth callback

- [`oauth/.../callback`](../../apps/web/src/app/api/oauth/[provider]/callback/route.ts): `verifyOAuthState` (HMAC, CSRF cross-provider), `exchangeCodeForTokens`, `storeCredentials`, upsert connection.

**Werdykt:** **PASS**.

### 5.3 Generic disconnect

- [`disconnectGeneric`](../../packages/api/src/routers/integration.ts): `deleteCredentials` + `credentialsRef: ""`.

**Werdykt:** **PASS** dla providerów obsługiwanych tą ścieżką.

---

## 6. Podsumowanie PASS / GAP / RISK (zaktualizowano po wdrożeniu)

| ID | Obszar | Status | Uwagi |
|----|--------|--------|--------|
| I1 | Sekrety przy disconnect (KSeF, Peppol, Jira) | **NAPRAWIONE** | `deleteCredentials` + `credentialsRef: ""` w [`ksef.ts`](../../packages/api/src/routers/ksef.ts), [`peppol.ts`](../../packages/api/src/routers/peppol.ts), [`jira.ts`](../../packages/api/src/routers/jira.ts). |
| I2 | AuditLog dla connect/disconnect | **NAPRAWIONE (częściowo)** | KSeF connect/disconnect, Peppol connect/disconnect, Jira disconnect; OAuth: [`oauth/.../callback`](../../apps/web/src/app/api/oauth/[provider]/callback/route.ts) (`integration.oauth.connected`). |
| I3 | KSeF sync: status przy częściowych błędach | **NAPRAWIONE** | Przy `errors.length > 0`: `IntegrationSyncLog.status = FAILED`, `errorMessage` + `responsePayloadJson` w [`ksef-sync-orchestrator.ts`](../../packages/api/src/services/ksef-sync-orchestrator.ts). |
| I4 | Certyfikat KSeF przy connect | **NAPRAWIONE** | Jawny `BAD_REQUEST` jeśli `authMethod === "certificate"` — zgodnie z tym, że `KsefApiClient.authenticateWithCertificate` nie jest zaimplementowane. |
| I5 | `prisma` vs `ctx.db` w routerach integracji | **RISK (zaakceptowane)** | W `packages/api/src/routers` **nie ma** użycia `ctx.db` — procedury używają globalnego `prisma` + filtr `organizationId`. [`tenant.ts`](../../packages/api/src/middleware/tenant.ts) ustawia `ctx.db` (regionalny klient), lecz routery z niego nie korzystają. Pełne przejście na `ctx.db` to osobny, szeroki refaktor (RLS/spójność regionu). |
| I6 | Webhook `organizationId` pusty | **NAPRAWIONE (Slack) + MITIGACJA (Jira/Linear)** | Slack: lookup po `configJson.teamId` w ingress (§11). Jira/Linear: guard w `_process` (§10). |
| I7 | Kalendarz (Google/Outlook) `disconnect` | **NAPRAWIONE** | [`calendar.ts`](../../packages/api/src/routers/calendar.ts): `deleteCredentials`, `credentialsRef: ""`, audyt `integration.calendar.disconnected`. |
| I8 | Teams / eSign audyt przy disconnect z UI | **NAPRAWIONE** | UI używa `disconnectGeneric` — audyt `integration.provider.disconnected` (§11). |

---

## 7. Testy do uruchomienia (regresja)

- `packages/api/src/routers/__tests__/ksef.test.ts`
- `packages/api/src/routers/__tests__/integration.test.ts`
- `apps/web/src/hooks/__tests__/use-permissions-parity.test.ts`
- Pakiet `packages/integrations` — testy webhook dispatcher

Polecenie (z root repo): `pnpm test` lub `pnpm exec vitest run …` (dostosować do skryptów w `package.json`).

**Uwaga:** `pnpm exec vitest run` z `packages/api` — [`ksef.test.ts`](../../packages/api/src/routers/__tests__/ksef.test.ts): 10/10 OK po dodaniu mocków `getRegionalClient` i `auditLog`. [`jira.test.ts`](../../packages/api/src/routers/__tests__/jira.test.ts) może wymagać zbudowanego workspace (`@contractor-ops/einvoice` w łańcuchu `validators`).

---

## 8. Postęp wdrożeniowy

Wykonano poprawki kodu zgodnie z sekcją 6 (I1–I4). OAuth callback zapisuje audyt połączeń dla wszystkich providerów OAuth używających wspólnej trasy.

---

## 9. Zakończenie (stan po naprawach)

Pierwotny plan weryfikacji (inwentaryzacja + checklista) został uzupełniony **implementacją** luk I1–I4 oraz aktualizacją testów KSeF / Jira (asercje audytu i `deleteCredentials`).

---

## 10. Runda 2 audytu (kontynuacja)

- **I5:** Potwierdzono brak `ctx.db` w routerach — decyzja dokumentacyjna, bez zmiany kodu.
- **I6:** Dodano ochronę w `_process` dla webhooków wymagających tenanta (Jira, Linear).
- **I7:** Ujednolicono cykl sekretów i audyt przy disconnect kalendarza (OAuth Google/Outlook).

**Następne kroki (opcjonalnie):** migracja wybranych routerów na `ctx.db` po ustaleniu standardu zespołu.

---

## 11. Runda 3 audytu (Slack ingress + Teams/eSign disconnect)

### 11.1 Slack — `organizationId` w ingress

- Moduł [`slack-webhook-context.ts`](../../apps/web/src/app/api/webhooks/slack-webhook-context.ts): `extractSlackTeamId` (payload interactivity / Events API) oraz `resolveSlackConnectionByTeamId` — SQL na `IntegrationConnection` (`provider = SLACK`, `status = CONNECTED`, `configJson->>'teamId'` = workspace z OAuth).
- [`webhooks/[provider]/route.ts`](../../apps/web/src/app/api/webhooks/[provider]/route.ts): body Slacka obsługiwany jako **JSON** (Events API) lub **form-urlencoded** (interactivity); po weryfikacji podpisu uzupełniany `organizationId` / `integrationConnectionId`, gdy adapter ich nie zwraca.
- Testy: [`slack-webhook-context.test.ts`](../../apps/web/src/app/api/webhooks/__tests__/slack-webhook-context.test.ts), rozszerzony [`[provider]/__tests__/route.test.ts`](../../apps/web/src/app/api/webhooks/[provider]/__tests__/route.test.ts).

### 11.2 Teams / DocuSign / Autenti — sekrety i audyt

- **Sekrety:** odłączenie z UI idzie przez [`disconnectGeneric`](../../packages/api/src/routers/integration.ts) (`provider-connection-card`) — już wcześniej `deleteCredentials` + `credentialsRef: ""`.
- **Audyt:** dodano `auditLog` przy **`disconnectGeneric`** (`integration.provider.disconnected` + `provider` w `oldValuesJson`) oraz przy dedykowanym **[`integration.disconnect`](../../packages/api/src/routers/integration.ts)** dla Slack (`integration.slack.disconnected`), na wypadek wywołań poza `disconnectGeneric`.

---

## 12. Runda 4 (Resend + `_process`)

### 12.1 Resend — slug vs `Organization.id`

- [`WebhookVerificationResult`](../../packages/integrations/src/types/webhook.ts): pole **`organizationSlug`** (domena mailowa → fragment przed `.contractorhub.io`) — rozróżnienie od **`organizationId`** (cuid FK do `Organization`).
- [`resend-adapter.ts`](../../packages/integrations/src/adapters/resend-adapter.ts): weryfikacja zwraca wyłącznie `organizationSlug`, nie udaje slugiem identyfikatora organizacji.
- [`webhooks/[provider]/route.ts`](../../apps/web/src/app/api/webhooks/[provider]/route.ts): dla `provider === "resend"` wykonywane jest `prisma.organization.findUnique({ where: { slug } })`; zapis `WebhookDelivery.organizationId` tylko po rozwiązaniu FK. Gdy slug nie pasuje do żadnej organizacji — odpowiedź `200` z `{ persisted: false }`, bez rekordu dostawy (uniknięcie naruszenia FK).

### 12.2 `_process` — backfill `organizationId` z połączenia

- [`_process/route.ts`](../../apps/web/src/app/api/webhooks/_process/route.ts): jeśli `WebhookDelivery.organizationId` jest puste, a ustawione jest `integrationConnectionId`, pobierane jest `organizationId` z `IntegrationConnection` i **aktualizowany** rekord dostawy przed dispatch do adaptera / guardów Jira/Linear.
- Testy: [`resend-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/resend-adapter.test.ts), rozszerzone [`[provider]/__tests__/route.test.ts`](../../apps/web/src/app/api/webhooks/[provider]/__tests__/route.test.ts), [`_process/__tests__/route.test.ts`](../../apps/web/src/app/api/webhooks/_process/__tests__/route.test.ts).
