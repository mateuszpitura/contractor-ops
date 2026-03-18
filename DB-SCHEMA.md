# Contractor Ops — Data Model & Database Schema

**Wersja:** 1.1 (zrewidowana)
**Data:** 2026-03-18
**Status:** Draft → Review
**Źródło:** GPT (oryginał) → Claude (rewizja, korekty, uzupełnienia)
**Baza:** PostgreSQL + Prisma ORM

---

## Spis treści

1. [Założenia modelu](#1-założenia-modelu)
2. [Bounded Contexts](#2-bounded-contexts)
3. [Relacje — przegląd](#3-relacje--przegląd)
4. [Detailed Data Model — encje i pola](#4-detailed-data-model--encje-i-pola)
5. [Enums](#5-enums)
6. [Constraints & Indexes](#6-constraints--indexes)
7. [Prisma Schema](#7-prisma-schema)
8. [⚠️ Korekty względem oryginału](#8-️-korekty-względem-oryginału)
9. [MVP Database Scope](#9-mvp-database-scope)
10. [Czego nie modelować w v1](#10-czego-nie-modelować-w-v1)
11. [Decyzje architektoniczne](#11-decyzje-architektoniczne)
12. [Pułapki](#12-pułapki)

---

## 1. Założenia modelu

### Główne zasady

- **Multi-tenant** — każda encja posiada `organization_id` (nawet jeśli relacja pośrednia istnieje, dla prostoty policy enforcement i indeksów)
- **Mocna org isolation** — brak cross-tenant leakage, org_id w każdym query via middleware
- **Source of record** — Contractor jako centralny byt, nie dokument
- **Historia zmian** — immutable audit log, osobna tabela rate periods, billing profile z validity range
- **Soft delete** — `deleted_at` tam, gdzie usunięcie musi być reversible (Contractor, Contract, Invoice, Document)
- **Extensibility** — `custom_fields_json` / `metadata_json` / `config_json` dla przyszłych rozszerzeń bez migracji
- **Relational-first** — JSON jest wsparciem, nie zamiennikiem relacji; core data zawsze relacyjne

### Kluczowe obiekty domenowe

```
Organization → User → Contractor → Contract → Invoice → Approval → PaymentRun
                                  → Document
                                  → WorkflowRun → WorkflowTaskRun
                                  → ComplianceItem
```

---

## 2. Bounded Contexts

### Identity & Tenant

- Organization
- User
- UserRoleAssignment
- (Session / auth — poza business DB, np. w auth provider)

### Organizational Structure

- Team
- Project
- CostCenter

### Contractor Ops

- Contractor
- ContractorContact
- ContractorBillingProfile
- ContractorAssignment
- ContractorTag / ContractorTagLink

### Contracts & Documents

- Contract
- ContractAmendment
- ContractRatePeriod
- Document
- DocumentLink
- ComplianceRequirementTemplate
- ContractorComplianceItem

### Workflow Engine

- WorkflowTemplate
- WorkflowTaskTemplate
- WorkflowRun
- WorkflowTaskRun
- WorkflowComment
- WorkflowAttachment

### Finance Ops

- Invoice
- InvoiceFile
- InvoiceLine
- InvoiceMatchResult
- ApprovalChainConfig _(brakował w oryginale)_
- ApprovalFlow
- ApprovalStep
- ApprovalDecision
- PaymentRun
- PaymentRunItem
- PaymentExport

### Integrations

- IntegrationConnection
- IntegrationSyncLog
- ExternalLink
- WebhookDelivery

### Communication

- Notification
- UserNotificationPreference _(brakował w oryginale)_
- Comment _(brakował — polymorphic, nie tylko workflow)_
- ReminderRule
- ReminderInstance

### Audit & Events

- AuditLog
- OutboxEvent

---

## 3. Relacje — przegląd

```
Organization 1:N Users
Organization 1:N Contractors
Organization 1:N Contracts
Organization 1:N Invoices
Organization 1:N WorkflowTemplates
Organization 1:N WorkflowRuns
Organization 1:N PaymentRuns
Organization 1:N IntegrationConnections
Organization 1:N Teams
Organization 1:N Projects
Organization 1:N CostCenters

User 1:N UserRoleAssignments
User 1:N OwnedContractors
User 1:N AssignedWorkflowTasks
User 1:N ApprovalSteps (as approver)
User 1:N Notifications

Contractor 1:N Contracts
Contractor 1:N ContractorContacts
Contractor 1:N ContractorBillingProfiles
Contractor 1:N ContractorAssignments
Contractor 1:N Invoices
Contractor 1:N WorkflowRuns
Contractor 1:N ComplianceItems
Contractor N:M Tags (via ContractorTagLink)

Contract 1:N Documents (via DocumentLink)
Contract 1:N Amendments
Contract 1:N RatePeriods
Contract 1:N Invoices
Contract 1:N ComplianceItems
Contract 1:N WorkflowRuns

Invoice 1:N InvoiceFiles
Invoice 1:N InvoiceLines
Invoice 1:N InvoiceMatchResults
Invoice N:1 PaymentRunItem
Invoice 1:1 ApprovalFlow (per invoice per submission)

Document 1:N DocumentLinks (polymorphic to any entity)
Document — can be linked to: Contractor, Contract, Invoice, WorkflowRun, Organization

WorkflowTemplate 1:N WorkflowTaskTemplates
WorkflowRun 1:N WorkflowTaskRuns
WorkflowRun 1:N WorkflowComments
WorkflowRun 1:N WorkflowAttachments

PaymentRun 1:N PaymentRunItems
PaymentRun 1:N PaymentExports

IntegrationConnection 1:N ExternalLinks
IntegrationConnection 1:N IntegrationSyncLogs
```

---

## 4. Detailed Data Model — encje i pola

> Notacja: `PK` = Primary Key, `FK` = Foreign Key, `?` = nullable

### 4.1 ORGANIZATION

| Field                   | Type                | Notes                              |
| ----------------------- | ------------------- | ---------------------------------- |
| id                      | UUID PK             |                                    |
| slug                    | VARCHAR(100) UNIQUE | Subdomain / org routing            |
| name                    | VARCHAR(255)        | Display name                       |
| legal_name              | VARCHAR(500)?       | Official legal name                |
| country_code            | CHAR(2)             | ISO 3166-1 alpha-2                 |
| default_currency        | CHAR(3)             | ISO 4217                           |
| timezone                | VARCHAR(50)         | e.g., 'Europe/Warsaw'              |
| language                | VARCHAR(10)         | e.g., 'pl', 'en'                   |
| fiscal_year_start_month | INT?                | 1–12, default 1 (January)          |
| status                  | ENUM                | ACTIVE, SUSPENDED, TRIAL, ARCHIVED |
| billing_email           | VARCHAR(255)?       |                                    |
| settings_json           | JSONB?              | Feature flags, defaults            |
| created_at              | TIMESTAMPTZ         |                                    |
| updated_at              | TIMESTAMPTZ         |                                    |
| deleted_at              | TIMESTAMPTZ?        | Soft delete                        |

### 4.2 USER

| Field           | Type                   | Notes                               |
| --------------- | ---------------------- | ----------------------------------- |
| id              | UUID PK                |                                     |
| organization_id | UUID FK → Organization |                                     |
| email           | VARCHAR(255)           |                                     |
| first_name      | VARCHAR(100)           |                                     |
| last_name       | VARCHAR(100)           |                                     |
| display_name    | VARCHAR(255)           | Computed or overridden              |
| job_title       | VARCHAR(255)?          |                                     |
| status          | ENUM                   | INVITED, ACTIVE, DISABLED, ARCHIVED |
| avatar_url      | VARCHAR(1000)?         |                                     |
| last_login_at   | TIMESTAMPTZ?           |                                     |
| created_at      | TIMESTAMPTZ            |                                     |
| updated_at      | TIMESTAMPTZ            |                                     |
| deleted_at      | TIMESTAMPTZ?           |                                     |

**Constraint:** UNIQUE (organization_id, email)

### 4.3 USER_ROLE_ASSIGNMENT

Jeden user może mieć wiele ról (np. OPS_MANAGER + TEAM_MANAGER dla konkretnego teamu).

| Field           | Type           | Notes                                                                                              |
| --------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| id              | UUID PK        |                                                                                                    |
| organization_id | UUID FK        |                                                                                                    |
| user_id         | UUID FK → User |                                                                                                    |
| role            | ENUM           | ORG_ADMIN, FINANCE_ADMIN, OPS_MANAGER, TEAM_MANAGER, LEGAL_VIEWER, IT_ADMIN, ACCOUNTANT, READ_ONLY |
| scope_type      | ENUM?          | ORGANIZATION, TEAM, PROJECT, COST_CENTER                                                           |
| scope_id        | UUID?          | FK to scoped entity (when scope_type is set)                                                       |
| created_at      | TIMESTAMPTZ    |                                                                                                    |

**Scope rationale:** Dziś dajemy global roles. Jutro: finance tylko dla jednego business unit, manager tylko dla danego teamu.

### 4.4 TEAM

| Field           | Type            | Notes                      |
| --------------- | --------------- | -------------------------- |
| id              | UUID PK         |                            |
| organization_id | UUID FK         |                            |
| name            | VARCHAR(255)    |                            |
| code            | VARCHAR(50)?    | Internal code              |
| manager_user_id | UUID? FK → User |                            |
| status          | ENUM            | ACTIVE, INACTIVE, ARCHIVED |
| created_at      | TIMESTAMPTZ     |                            |
| updated_at      | TIMESTAMPTZ     |                            |

### 4.5 PROJECT

| Field           | Type            | Notes                                  |
| --------------- | --------------- | -------------------------------------- |
| id              | UUID PK         |                                        |
| organization_id | UUID FK         |                                        |
| name            | VARCHAR(255)    |                                        |
| code            | VARCHAR(50)?    |                                        |
| team_id         | UUID? FK → Team |                                        |
| status          | ENUM            | ACTIVE, INACTIVE, ARCHIVED             |
| start_date      | DATE?           |                                        |
| end_date        | DATE?           |                                        |
| budget_amount   | DECIMAL(18,2)?  | _Dodane — przydatne do spend tracking_ |
| budget_currency | CHAR(3)?        |                                        |
| created_at      | TIMESTAMPTZ     |                                        |
| updated_at      | TIMESTAMPTZ     |                                        |

### 4.6 COST_CENTER

| Field           | Type         | Notes                      |
| --------------- | ------------ | -------------------------- |
| id              | UUID PK      |                            |
| organization_id | UUID FK      |                            |
| name            | VARCHAR(255) |                            |
| code            | VARCHAR(50)  |                            |
| status          | ENUM         | ACTIVE, INACTIVE, ARCHIVED |
| created_at      | TIMESTAMPTZ  |                            |
| updated_at      | TIMESTAMPTZ  |                            |

**Constraint:** UNIQUE (organization_id, code)

### 4.7 CONTRACTOR

Centralny byt systemu.

| Field                  | Type                  | Notes                                              |
| ---------------------- | --------------------- | -------------------------------------------------- |
| id                     | UUID PK               |                                                    |
| organization_id        | UUID FK               |                                                    |
| type                   | ENUM                  | SOLE_TRADER, COMPANY, INDIVIDUAL_FREELANCER, OTHER |
| legal_name             | VARCHAR(500)          |                                                    |
| display_name           | VARCHAR(255)          |                                                    |
| tax_id                 | VARCHAR(50)?          | NIP                                                |
| vat_id                 | VARCHAR(50)?          | NIP-EU / VAT-EU                                    |
| registration_number    | VARCHAR(50)?          | REGON / KRS                                        |
| country_code           | CHAR(2)               |                                                    |
| currency               | CHAR(3)               | Default billing currency                           |
| email                  | VARCHAR(255)?         |                                                    |
| phone                  | VARCHAR(50)?          |                                                    |
| website                | VARCHAR(500)?         |                                                    |
| address_line_1         | VARCHAR(500)?         | _Dodane — brakował adres na contractor_            |
| address_line_2         | VARCHAR(500)?         |                                                    |
| city                   | VARCHAR(255)?         |                                                    |
| postal_code            | VARCHAR(20)?          |                                                    |
| status                 | ENUM                  | ACTIVE, INACTIVE, ARCHIVED                         |
| lifecycle_stage        | ENUM                  | DRAFT, ONBOARDING, ACTIVE, OFFBOARDING, ENDED      |
| owner_user_id          | UUID? FK → User       |                                                    |
| primary_team_id        | UUID? FK → Team       |                                                    |
| primary_project_id     | UUID? FK → Project    |                                                    |
| default_cost_center_id | UUID? FK → CostCenter |                                                    |
| notes                  | TEXT?                 |                                                    |
| is_sensitive           | BOOLEAN default false | GDPR: extra masking                                |
| custom_fields_json     | JSONB?                | _Dodane — custom fields extensibility_             |
| created_at             | TIMESTAMPTZ           |                                                    |
| updated_at             | TIMESTAMPTZ           |                                                    |
| archived_at            | TIMESTAMPTZ?          |                                                    |
| deleted_at             | TIMESTAMPTZ?          |                                                    |

**Rozdzielenie `status` vs `lifecycle_stage`:**

- `status` = jest widoczny/aktywny w systemie (ACTIVE/INACTIVE/ARCHIVED)
- `lifecycle_stage` = gdzie jest w procesie (DRAFT → ONBOARDING → ACTIVE → OFFBOARDING → ENDED)

### 4.8 CONTRACTOR_CONTACT

Kontraktor może mieć kilka osób kontaktowych.

| Field           | Type                  | Notes                              |
| --------------- | --------------------- | ---------------------------------- |
| id              | UUID PK               |                                    |
| organization_id | UUID FK               |                                    |
| contractor_id   | UUID FK → Contractor  |                                    |
| full_name       | VARCHAR(255)          |                                    |
| email           | VARCHAR(255)          |                                    |
| phone           | VARCHAR(50)?          |                                    |
| role_title      | VARCHAR(255)?         | e.g., "Accountant", "Project Lead" |
| is_primary      | BOOLEAN default false |                                    |
| created_at      | TIMESTAMPTZ           |                                    |
| updated_at      | TIMESTAMPTZ           |                                    |

### 4.9 CONTRACTOR_BILLING_PROFILE

Odseparowane od Contractor — billing bywa zmienny i historyczny.

| Field                  | Type                  | Notes                        |
| ---------------------- | --------------------- | ---------------------------- |
| id                     | UUID PK               |                              |
| organization_id        | UUID FK               |                              |
| contractor_id          | UUID FK → Contractor  |                              |
| legal_entity_name      | VARCHAR(500)          |                              |
| billing_email          | VARCHAR(255)?         |                              |
| country_code           | CHAR(2)               |                              |
| address_line_1         | VARCHAR(500)?         |                              |
| address_line_2         | VARCHAR(500)?         |                              |
| city                   | VARCHAR(255)?         |                              |
| postal_code            | VARCHAR(20)?          |                              |
| bank_account_masked    | VARCHAR(34)?          | Display: `PL** **** **34 56` |
| bank_account_encrypted | TEXT?                 | AES-256 encrypted IBAN       |
| bank_name              | VARCHAR(255)?         |                              |
| swift_bic              | VARCHAR(11)?          |                              |
| preferred_currency     | CHAR(3)               |                              |
| payment_terms_days     | INT?                  |                              |
| tax_id                 | VARCHAR(50)?          |                              |
| vat_id                 | VARCHAR(50)?          |                              |
| is_default             | BOOLEAN default false |                              |
| valid_from             | DATE                  |                              |
| valid_to               | DATE?                 | NULL = currently valid       |
| created_at             | TIMESTAMPTZ           |                              |
| updated_at             | TIMESTAMPTZ           |                              |

**Ważne:** Raw bank data encrypted at application level. Nigdy plaintext w DB.

### 4.10 CONTRACTOR_ASSIGNMENT

Powiązanie kontraktora z team / project / cost center.

| Field              | Type                  | Notes                                              |
| ------------------ | --------------------- | -------------------------------------------------- |
| id                 | UUID PK               |                                                    |
| organization_id    | UUID FK               |                                                    |
| contractor_id      | UUID FK → Contractor  |                                                    |
| team_id            | UUID? FK → Team       |                                                    |
| project_id         | UUID? FK → Project    |                                                    |
| cost_center_id     | UUID? FK → CostCenter |                                                    |
| owner_user_id      | UUID? FK → User       | Kto odpowiada za tego kontraktora w tym assignment |
| allocation_percent | DECIMAL(5,2)?         | e.g., 50.00 = 50%                                  |
| active_from        | DATE                  |                                                    |
| active_to          | DATE?                 |                                                    |
| status             | ENUM                  | ACTIVE, ENDED, PLANNED                             |
| created_at         | TIMESTAMPTZ           |                                                    |
| updated_at         | TIMESTAMPTZ           |                                                    |

### 4.11 CONTRACTOR_TAG

| Field           | Type         | Notes                      |
| --------------- | ------------ | -------------------------- |
| id              | UUID PK      |                            |
| organization_id | UUID FK      |                            |
| name            | VARCHAR(100) |                            |
| color           | VARCHAR(7)?  | Hex color, e.g., `#3B82F6` |
| created_at      | TIMESTAMPTZ  |                            |

**Constraint:** UNIQUE (organization_id, name)

### 4.12 CONTRACTOR_TAG_LINK

| Field         | Type                    | Notes |
| ------------- | ----------------------- | ----- |
| contractor_id | UUID FK → Contractor    |       |
| tag_id        | UUID FK → ContractorTag |       |

**Constraint:** Composite PK (contractor_id, tag_id)

### 4.13 CONTRACT

| Field                           | Type                  | Notes                                                                                 |
| ------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| id                              | UUID PK               |                                                                                       |
| organization_id                 | UUID FK               |                                                                                       |
| contractor_id                   | UUID FK → Contractor  |                                                                                       |
| contract_number                 | VARCHAR(100)?         | Internal reference                                                                    |
| title                           | VARCHAR(500)          |                                                                                       |
| type                            | ENUM                  | B2B_MASTER_SERVICE, STATEMENT_OF_WORK, NDA, IP_ASSIGNMENT, DPA, OTHER                 |
| status                          | ENUM                  | DRAFT, PENDING_SIGNATURE, ACTIVE, EXPIRING, EXPIRED, TERMINATED, SUPERSEDED, ARCHIVED |
| start_date                      | DATE                  |                                                                                       |
| end_date                        | DATE?                 | NULL = indefinite                                                                     |
| notice_period_days              | INT?                  |                                                                                       |
| auto_renewal                    | BOOLEAN default false |                                                                                       |
| renewal_terms                   | TEXT?                 |                                                                                       |
| currency                        | CHAR(3)               |                                                                                       |
| billing_model                   | ENUM                  | MONTHLY_RETAINER, HOURLY, DAILY, MILESTONE, DELIVERABLE_BASED, MIXED                  |
| rate_type                       | ENUM                  | MONTHLY_FIXED, PER_HOUR, PER_DAY, PER_MILESTONE, PER_DELIVERABLE                      |
| rate_value                      | DECIMAL(18,2)?        |                                                                                       |
| expected_hours_per_period       | DECIMAL(10,2)?        | For hourly contracts                                                                  |
| retainer_amount                 | DECIMAL(18,2)?        | For retainer contracts                                                                |
| payment_terms_days              | INT?                  | e.g., 14, 30                                                                          |
| invoice_cycle                   | ENUM?                 | WEEKLY, BIWEEKLY, MONTHLY, ON_DELIVERABLE, AD_HOC                                     |
| expense_reimbursement_allowed   | BOOLEAN default false |                                                                                       |
| requires_timesheet              | BOOLEAN default false |                                                                                       |
| requires_deliverable_acceptance | BOOLEAN default false |                                                                                       |
| internal_owner_user_id          | UUID? FK → User       |                                                                                       |
| team_id                         | UUID? FK → Team       |                                                                                       |
| project_id                      | UUID? FK → Project    |                                                                                       |
| cost_center_id                  | UUID? FK → CostCenter |                                                                                       |
| compliance_risk_level           | ENUM?                 | LOW, MEDIUM, HIGH                                                                     |
| notes                           | TEXT?                 |                                                                                       |
| signed_at                       | TIMESTAMPTZ?          |                                                                                       |
| terminated_at                   | TIMESTAMPTZ?          |                                                                                       |
| termination_reason              | TEXT?                 |                                                                                       |
| metadata_json                   | JSONB?                | Flexible extra fields                                                                 |
| created_at                      | TIMESTAMPTZ           |                                                                                       |
| updated_at                      | TIMESTAMPTZ           |                                                                                       |
| deleted_at                      | TIMESTAMPTZ?          |                                                                                       |

**Dlaczego osobno `billing_model` i `rate_type`?** Bo np. billing_model = HOURLY + rate_type = PER_HOUR, ale też billing_model = RETAINER + rate_type = MONTHLY_FIXED. To dwie różne osie.

### 4.14 CONTRACT_AMENDMENT

| Field                | Type               | Notes                                  |
| -------------------- | ------------------ | -------------------------------------- |
| id                   | UUID PK            |                                        |
| organization_id      | UUID FK            |                                        |
| contract_id          | UUID FK → Contract |                                        |
| amendment_number     | VARCHAR(50)?       |                                        |
| title                | VARCHAR(500)       |                                        |
| effective_date       | DATE               |                                        |
| description          | TEXT?              |                                        |
| changes_summary_json | JSONB              | Semantic change record, nie tylko plik |
| created_at           | TIMESTAMPTZ        |                                        |
| updated_at           | TIMESTAMPTZ        |                                        |

### 4.15 CONTRACT_RATE_PERIOD

Historyzacja stawek — lepsze niż nadpisywanie jednej stawki w Contract.

| Field           | Type               | Notes                   |
| --------------- | ------------------ | ----------------------- |
| id              | UUID PK            |                         |
| organization_id | UUID FK            |                         |
| contract_id     | UUID FK → Contract |                         |
| rate_type       | ENUM               |                         |
| rate_value      | DECIMAL(18,2)      |                         |
| currency        | CHAR(3)            |                         |
| valid_from      | DATE               |                         |
| valid_to        | DATE?              | NULL = currently active |
| created_at      | TIMESTAMPTZ        |                         |

### 4.16 DOCUMENT

Uniwersalny file storage entity.

| Field               | Type                  | Notes                                                  |
| ------------------- | --------------------- | ------------------------------------------------------ |
| id                  | UUID PK               |                                                        |
| organization_id     | UUID FK               |                                                        |
| storage_key         | VARCHAR(1000)         | S3/R2 key                                              |
| original_file_name  | VARCHAR(500)          |                                                        |
| mime_type           | VARCHAR(100)          |                                                        |
| file_size_bytes     | BIGINT                | _Poprawione z INT — obsługa plików >2GB_               |
| checksum_sha256     | VARCHAR(64)           |                                                        |
| document_type       | ENUM                  |                                                        |
| status              | ENUM                  | ACTIVE, SUPERSEDED, EXPIRED, ARCHIVED                  |
| visibility          | ENUM                  | PRIVATE, INTERNAL, SHARED_WITH_ACCOUNTANT              |
| uploaded_by_user_id | UUID? FK → User       |                                                        |
| source              | ENUM                  | USER_UPLOAD, EMAIL_INTAKE, ESIGN, KSEF, API, GENERATED |
| virus_scan_status   | ENUM                  | PENDING, CLEAN, INFECTED, FAILED                       |
| encrypted           | BOOLEAN default false | At-rest encryption flag                                |
| created_at          | TIMESTAMPTZ           |                                                        |
| updated_at          | TIMESTAMPTZ           |                                                        |
| deleted_at          | TIMESTAMPTZ?          |                                                        |

### 4.17 DOCUMENT_LINK

Polymorphic link — jeden dokument może dotyczyć wielu bytów.

| Field           | Type               | Notes                                                           |
| --------------- | ------------------ | --------------------------------------------------------------- |
| id              | UUID PK            |                                                                 |
| organization_id | UUID FK            |                                                                 |
| document_id     | UUID FK → Document |                                                                 |
| entity_type     | ENUM               | CONTRACTOR, CONTRACT, INVOICE, WORKFLOW_RUN, ORGANIZATION, etc. |
| entity_id       | UUID               |                                                                 |
| link_role       | ENUM               | PRIMARY, SUPPORTING, GENERATED_OUTPUT, SIGNED_COPY              |
| created_at      | TIMESTAMPTZ        |                                                                 |

**Dlaczego nie FK na Document do każdej encji?** Bo jeden plik (np. NDA) może dotyczyć kontraktora i kontraktu jednocześnie. DocumentLink jest znacznie elastyczniejszy.

### 4.18 COMPLIANCE_REQUIREMENT_TEMPLATE

Template wymagań dokumentowych per organizacja.

| Field                      | Type         | Notes                                    |
| -------------------------- | ------------ | ---------------------------------------- |
| id                         | UUID PK      |                                          |
| organization_id            | UUID FK      |                                          |
| name                       | VARCHAR(255) | e.g., "NDA required for all contractors" |
| applies_to_contractor_type | ENUM?        | NULL = applies to all                    |
| document_type              | ENUM         |                                          |
| is_required                | BOOLEAN      |                                          |
| expires                    | BOOLEAN      | Document has expiry date                 |
| default_validity_days      | INT?         | Auto-calculate expiry                    |
| created_at                 | TIMESTAMPTZ  |                                          |

### 4.19 CONTRACTOR_COMPLIANCE_ITEM

Stan wymagania dla konkretnego kontraktora.

| Field                    | Type                 | Notes                                        |
| ------------------------ | -------------------- | -------------------------------------------- |
| id                       | UUID PK              |                                              |
| organization_id          | UUID FK              |                                              |
| contractor_id            | UUID FK → Contractor |                                              |
| contract_id              | UUID? FK → Contract  |                                              |
| requirement_template_id  | UUID? FK             |                                              |
| name                     | VARCHAR(255)         |                                              |
| document_type            | ENUM                 |                                              |
| status                   | ENUM                 | MISSING, PENDING, SATISFIED, EXPIRED, WAIVED |
| due_date                 | DATE?                |                                              |
| satisfied_by_document_id | UUID? FK → Document  |                                              |
| expires_at               | DATE?                |                                              |
| notes                    | TEXT?                |                                              |
| created_at               | TIMESTAMPTZ          |                                              |
| updated_at               | TIMESTAMPTZ          |                                              |

### 4.20–4.26 WORKFLOW ENGINE

_(Tabele WorkflowTemplate, WorkflowTaskTemplate, WorkflowRun, WorkflowTaskRun, WorkflowComment, WorkflowAttachment — bez zmian względem oryginału, pola poprawne.)_

**Jedyne uzupełnienie — WorkflowAttachment brakowało w Prisma schema:**

**WORKFLOW_ATTACHMENT:**

| Field                | Type                       | Notes |
| -------------------- | -------------------------- | ----- |
| id                   | UUID PK                    |       |
| organization_id      | UUID FK                    |       |
| workflow_run_id      | UUID FK → WorkflowRun      |       |
| workflow_task_run_id | UUID? FK → WorkflowTaskRun |       |
| document_id          | UUID FK → Document         |       |
| created_at           | TIMESTAMPTZ                |       |

### 4.27 INVOICE

| Field                | Type                                | Notes                                                                     |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| id                   | UUID PK                             |                                                                           |
| organization_id      | UUID FK                             |                                                                           |
| contractor_id        | UUID? FK → Contractor               | Nullable — unmatched invoices                                             |
| contract_id          | UUID? FK → Contract                 |                                                                           |
| billing_profile_id   | UUID? FK → ContractorBillingProfile |                                                                           |
| invoice_number       | VARCHAR(100)                        |                                                                           |
| external_invoice_id  | VARCHAR(200)?                       | KSeF ID or other external ref                                             |
| source               | ENUM                                | MANUAL_UPLOAD, EMAIL_INTAKE, KSEF, API                                    |
| source_reference     | VARCHAR(500)?                       | Email message ID, KSeF ref, etc.                                          |
| issue_date           | DATE                                |                                                                           |
| service_period_start | DATE?                               |                                                                           |
| service_period_end   | DATE?                               |                                                                           |
| due_date             | DATE                                |                                                                           |
| currency             | CHAR(3)                             |                                                                           |
| subtotal_amount      | DECIMAL(18,2)                       | Netto                                                                     |
| vat_rate             | DECIMAL(5,2)?                       | _Dodane — brakował główny VAT rate_                                       |
| vat_amount           | DECIMAL(18,2)?                      |                                                                           |
| total_amount         | DECIMAL(18,2)                       | Brutto                                                                    |
| withholding_amount   | DECIMAL(18,2)?                      |                                                                           |
| amount_to_pay        | DECIMAL(18,2)                       |                                                                           |
| seller_tax_id        | VARCHAR(50)?                        | _Dodane — NIP ze faktury, kluczowy do matching_                           |
| seller_name          | VARCHAR(500)?                       | _Dodane — nazwa sprzedawcy z faktury_                                     |
| seller_bank_account  | VARCHAR(34)?                        | _Dodane — IBAN z faktury do walidacji_                                    |
| buyer_tax_id         | VARCHAR(50)?                        | _Dodane — NIP kupującego (nasza org)_                                     |
| status               | ENUM                                | High-level: RECEIVED, UNDER_REVIEW, etc.                                  |
| match_status         | ENUM                                | UNMATCHED, PARTIAL, MATCHED, DISCREPANCY, MANUALLY_CONFIRMED              |
| approval_status      | ENUM                                | NOT_STARTED, PENDING, APPROVED, REJECTED, CANCELLED                       |
| payment_status       | ENUM                                | NOT_READY, READY, IN_RUN, PARTIALLY_PAID, PAID, FAILED                    |
| duplicate_check_hash | VARCHAR(64)?                        | SHA256(invoice_number + seller_tax_id + total_amount + issue_date)        |
| received_at          | TIMESTAMPTZ                         |                                                                           |
| reviewed_at          | TIMESTAMPTZ?                        |                                                                           |
| approved_at          | TIMESTAMPTZ?                        |                                                                           |
| ready_for_payment_at | TIMESTAMPTZ?                        |                                                                           |
| paid_at              | TIMESTAMPTZ?                        |                                                                           |
| rejected_at          | TIMESTAMPTZ?                        |                                                                           |
| rejection_reason     | TEXT?                               |                                                                           |
| submitted_by_email   | VARCHAR(255)?                       | Email address that submitted (for email intake)                           |
| notes                | TEXT?                               |                                                                           |
| flags_json           | JSONB?                              | Array of flag codes, e.g., ["MISSING_CONTRACT", "AMOUNT_ABOVE_THRESHOLD"] |
| created_at           | TIMESTAMPTZ                         |                                                                           |
| updated_at           | TIMESTAMPTZ                         |                                                                           |
| deleted_at           | TIMESTAMPTZ?                        |                                                                           |

**Pola `seller_*` i `buyer_tax_id` są krytyczne** — bez nich matching do kontraktora (po NIP) i walidacja (czy faktura dotyczy naszej organizacji) nie działają.

### 4.28–4.30 INVOICE_FILE, INVOICE_LINE, INVOICE_MATCH_RESULT

_(Bez zmian — pola poprawne.)_

### 4.31 APPROVAL*CHAIN_CONFIG *(Dodana encja — brakowała w oryginale)\_

Konfiguracja ścieżki akceptacji (template). Oryginał miał tylko runtime instances (ApprovalFlow/Step), ale brakowało definicji konfiguracji.

| Field           | Type                  | Notes                                                                    |
| --------------- | --------------------- | ------------------------------------------------------------------------ |
| id              | UUID PK               |                                                                          |
| organization_id | UUID FK               |                                                                          |
| name            | VARCHAR(255)          | e.g., "Default invoice approval"                                         |
| resource_type   | ENUM                  | INVOICE, DOCUMENT, CONTRACT                                              |
| is_default      | BOOLEAN default false |                                                                          |
| is_active       | BOOLEAN default true  |                                                                          |
| conditions_json | JSONB?                | `{"amount_gte": 5000, "contractor_type": "COMPANY"}`                     |
| steps_json      | JSONB                 | `[{"order":1,"role":"TEAM_MANAGER"},{"order":2,"role":"FINANCE_ADMIN"}]` |
| created_at      | TIMESTAMPTZ           |                                                                          |
| updated_at      | TIMESTAMPTZ           |                                                                          |

**Dlaczego potrzebna?** Bez niej system nie wie, jaką ścieżkę akceptacji uruchomić dla nowej faktury. ApprovalFlow/Step to runtime instances — potrzebują template'u.

### 4.32–4.33 APPROVAL_FLOW, APPROVAL_STEP, APPROVAL_DECISION

_(Bez zmian — poprawne.)_

### 4.34–4.36 PAYMENT_RUN, PAYMENT_RUN_ITEM, PAYMENT_EXPORT

_(Bez zmian — poprawne.)_

### 4.37–4.40 INTEGRATION_CONNECTION, EXTERNAL_LINK, INTEGRATION_SYNC_LOG, WEBHOOK_DELIVERY

_(Bez zmian — poprawne.)_

### 4.41 NOTIFICATION

_(Bez zmian.)_

### 4.42 USER*NOTIFICATION_PREFERENCE *(Dodana encja — brakowała w oryginale)\_

| Field             | Type                  | Notes                                           |
| ----------------- | --------------------- | ----------------------------------------------- |
| id                | UUID PK               |                                                 |
| user_id           | UUID FK → User        |                                                 |
| organization_id   | UUID FK               |                                                 |
| notification_type | VARCHAR(100)          | e.g., 'approval_requested', 'contract_expiring' |
| channel_email     | BOOLEAN default true  |                                                 |
| channel_slack     | BOOLEAN default true  |                                                 |
| channel_in_app    | BOOLEAN default true  |                                                 |
| digest_mode       | BOOLEAN default false | Aggregate into daily digest                     |
| created_at        | TIMESTAMPTZ           |                                                 |
| updated_at        | TIMESTAMPTZ           |                                                 |

**Constraint:** UNIQUE (user_id, notification_type)

### 4.43 COMMENT _(Dodana encja — brakowała w oryginale)_

Polymorphic comments — nie tylko na workflow, ale też na invoices, contractors, contracts.

| Field           | Type           | Notes                                                                         |
| --------------- | -------------- | ----------------------------------------------------------------------------- |
| id              | UUID PK        |                                                                               |
| organization_id | UUID FK        |                                                                               |
| entity_type     | ENUM           | INVOICE, CONTRACTOR, CONTRACT, WORKFLOW_RUN, WORKFLOW_TASK_RUN, APPROVAL_STEP |
| entity_id       | UUID           |                                                                               |
| author_user_id  | UUID FK → User |                                                                               |
| body            | TEXT           |                                                                               |
| created_at      | TIMESTAMPTZ    |                                                                               |
| updated_at      | TIMESTAMPTZ    |                                                                               |

**Uwaga:** WorkflowComment z oryginału można zachować jako convenience relation, ale generic Comment daje spójny system komentarzy na każdym bycie.

### 4.44–4.45 REMINDER_RULE, REMINDER_INSTANCE

_(Bez zmian — poprawne.)_

### 4.46–4.47 AUDIT_LOG, OUTBOX_EVENT

_(Bez zmian — poprawne.)_

---

## 5. Enums

Poniżej pełna lista z naniesionymi korektami:

```
OrganizationStatus:      ACTIVE | SUSPENDED | TRIAL | ARCHIVED
UserStatus:              INVITED | ACTIVE | DISABLED | ARCHIVED
UserRole:                ORG_ADMIN | FINANCE_ADMIN | OPS_MANAGER | TEAM_MANAGER |
                         LEGAL_VIEWER | IT_ADMIN | ACCOUNTANT | READ_ONLY
ScopeType:               ORGANIZATION | TEAM | PROJECT | COST_CENTER
SimpleStatus:            ACTIVE | INACTIVE | ARCHIVED

ContractorType:          SOLE_TRADER | COMPANY | INDIVIDUAL_FREELANCER | OTHER
ContractorStatus:        ACTIVE | INACTIVE | ARCHIVED
ContractorLifecycleStage: DRAFT | ONBOARDING | ACTIVE | OFFBOARDING | ENDED
AssignmentStatus:        ACTIVE | ENDED | PLANNED

ContractType:            B2B_MASTER_SERVICE | STATEMENT_OF_WORK | NDA |
                         IP_ASSIGNMENT | DPA | OTHER
ContractStatus:          DRAFT | PENDING_SIGNATURE | ACTIVE | EXPIRING |
                         EXPIRED | TERMINATED | SUPERSEDED | ARCHIVED
                         ▲ EXPIRING dodane — brakowało w oryginale, potrzebne do alertów

BillingModel:            MONTHLY_RETAINER | HOURLY | DAILY | MILESTONE |
                         DELIVERABLE_BASED | MIXED
RateType:                MONTHLY_FIXED | PER_HOUR | PER_DAY |
                         PER_MILESTONE | PER_DELIVERABLE
InvoiceCycle:            WEEKLY | BIWEEKLY | MONTHLY | ON_DELIVERABLE | AD_HOC
ComplianceRiskLevel:     LOW | MEDIUM | HIGH

DocumentType:            MASTER_CONTRACT | AMENDMENT | NDA | IP_ASSIGNMENT | DPA |
                         TAX_CERTIFICATE | BUSINESS_REGISTRATION | INVOICE |
                         TIMESHEET | DELIVERABLE_ACCEPTANCE | PAYMENT_EXPORT |
                         INSURANCE | OTHER
                         ▲ INSURANCE dodane — przydatne dla compliance

DocumentStatus:          ACTIVE | SUPERSEDED | EXPIRED | ARCHIVED
DocumentVisibility:      PRIVATE | INTERNAL | SHARED_WITH_ACCOUNTANT
DocumentSource:          USER_UPLOAD | EMAIL_INTAKE | ESIGN | KSEF | API | GENERATED
VirusScanStatus:         PENDING | CLEAN | INFECTED | FAILED

EntityType:              ORGANIZATION | CONTRACTOR | CONTRACT | DOCUMENT | INVOICE |
                         WORKFLOW_RUN | WORKFLOW_TASK_RUN | PAYMENT_RUN |
                         PROJECT | TEAM | APPROVAL_FLOW
                         ▲ APPROVAL_FLOW dodane

DocumentLinkRole:        PRIMARY | SUPPORTING | GENERATED_OUTPUT | SIGNED_COPY
ComplianceStatus:        MISSING | PENDING | SATISFIED | EXPIRED | WAIVED

WorkflowTemplateType:    ONBOARDING | OFFBOARDING | DOCUMENT_COLLECTION |
                         COMPLIANCE_REVIEW | CUSTOM
WorkflowTemplateStatus:  DRAFT | ACTIVE | ARCHIVED
WorkflowTaskType:        DOCUMENT_COLLECTION | APPROVAL | ACCESS_GRANT |
                         ACCESS_REVOKE | FINANCE_SETUP | EQUIPMENT |
                         KNOWLEDGE_TRANSFER | MEETING | MANUAL |
                         NOTIFICATION
                         ▲ NOTIFICATION dodane — workflow task: "wyślij powiadomienie"

AssigneeMode:            FIXED_USER | ROLE_BASED | CONTRACTOR_OWNER |
                         CONTRACT_OWNER | PROJECT_MANAGER
WorkflowRunStatus:       NOT_STARTED | IN_PROGRESS | COMPLETED | CANCELLED |
                         BLOCKED | OVERDUE
WorkflowTaskStatus:      TODO | IN_PROGRESS | DONE | BLOCKED | SKIPPED |
                         CANCELLED | OVERDUE

InvoiceSource:           MANUAL_UPLOAD | EMAIL_INTAKE | KSEF | API
InvoiceStatus:           RECEIVED | UNDER_REVIEW | APPROVAL_PENDING | APPROVED |
                         REJECTED | READY_FOR_PAYMENT | PARTIALLY_PAID | PAID | VOID
InvoiceMatchStatus:      UNMATCHED | PARTIAL | MATCHED | DISCREPANCY |
                         MANUALLY_CONFIRMED
InvoiceFileRole:         SOURCE_ORIGINAL | PARSED_COPY | SUPPORTING_ATTACHMENT |
                         CORRECTION

ApprovalStatus:          NOT_STARTED | PENDING | APPROVED | REJECTED | CANCELLED
ApprovalDecisionType:    APPROVE | REJECT | REQUEST_CHANGES | DELEGATE

PaymentStatus:           NOT_READY | READY | IN_RUN | PARTIALLY_PAID | PAID | FAILED
PaymentRunStatus:        DRAFT | LOCKED | EXPORTED | COMPLETED | FAILED | CANCELLED
PaymentRunItemStatus:    PENDING | EXPORTED | PAID | FAILED | SKIPPED
PaymentExportFormat:     CSV | BANK_FILE | SEPA_XML | MT940 | XML | API_PUSH
                         ▲ SEPA_XML, MT940 dodane — konkretne formaty bankowe
ExportStatus:            GENERATED | DOWNLOADED | FAILED

MatchBy:                 RULE_ENGINE | MANUAL | INTEGRATION | OCR_EXTRACTION

IntegrationProvider:     SLACK | GOOGLE_WORKSPACE | MICROSOFT_365 | JIRA | ESIGN |
                         KSEF | ACCOUNTING | OPEN_BANKING | GITHUB | GITLAB
IntegrationStatus:       CONNECTED | DISCONNECTED | ERROR | REAUTH_REQUIRED
SyncDirection:           INBOUND | OUTBOUND
SyncStatus:              STARTED | SUCCESS | FAILED
WebhookDeliveryStatus:   RECEIVED | PROCESSED | FAILED

NotificationChannel:     IN_APP | EMAIL | SLACK
NotificationStatus:      PENDING | SENT | FAILED | READ

ReminderTriggerType:     BEFORE_DUE_DATE | ON_DUE_DATE | AFTER_DUE_DATE |
                         BEFORE_CONTRACT_END | BEFORE_DOCUMENT_EXPIRY |
                         ON_LIFECYCLE_CHANGE
                         ▲ ON_LIFECYCLE_CHANGE dodane

RecipientMode:           ENTITY_OWNER | FINANCE_TEAM | ASSIGNEE |
                         SPECIFIC_USER | ROLE
ReminderInstanceStatus:  PENDING | SENT | FAILED | CANCELLED

ActorType:               USER | SYSTEM | INTEGRATION | API_KEY
                         ▲ API_KEY dodane
OutboxStatus:            PENDING | PUBLISHED | FAILED
```

---

## 6. Constraints & Indexes

### Critical composite indexes

```sql
-- === CONTRACTOR ===
CREATE INDEX idx_contractor_org_status ON contractor(organization_id, status);
CREATE INDEX idx_contractor_org_lifecycle ON contractor(organization_id, lifecycle_stage);
CREATE INDEX idx_contractor_org_owner ON contractor(organization_id, owner_user_id);
CREATE INDEX idx_contractor_org_name ON contractor(organization_id, legal_name);
CREATE INDEX idx_contractor_org_taxid ON contractor(organization_id, tax_id);

-- Full-text search
CREATE INDEX idx_contractor_fts ON contractor USING gin(
  to_tsvector('simple',
    coalesce(legal_name,'') || ' ' ||
    coalesce(display_name,'') || ' ' ||
    coalesce(tax_id,'') || ' ' ||
    coalesce(email,'')
  )
);

-- === CONTRACT ===
CREATE INDEX idx_contract_org_contractor ON contract(organization_id, contractor_id, status);
CREATE INDEX idx_contract_org_enddate ON contract(organization_id, end_date);
CREATE INDEX idx_contract_org_owner ON contract(organization_id, internal_owner_user_id);
CREATE INDEX idx_contract_org_billing ON contract(organization_id, billing_model);
CREATE INDEX idx_contract_org_team ON contract(organization_id, team_id);
CREATE INDEX idx_contract_org_project ON contract(organization_id, project_id);

-- === DOCUMENT_LINK ===
CREATE INDEX idx_doclink_entity ON document_link(organization_id, entity_type, entity_id);
CREATE INDEX idx_doclink_document ON document_link(organization_id, document_id);

-- === WORKFLOW_RUN ===
CREATE INDEX idx_wfrun_org_status ON workflow_run(organization_id, status);
CREATE INDEX idx_wfrun_org_contractor ON workflow_run(organization_id, contractor_id);
CREATE INDEX idx_wfrun_org_entity ON workflow_run(organization_id, entity_type, entity_id);
CREATE INDEX idx_wfrun_org_due ON workflow_run(organization_id, due_at);

-- === WORKFLOW_TASK_RUN ===
CREATE INDEX idx_wftask_run_status ON workflow_task_run(organization_id, workflow_run_id, status);
CREATE INDEX idx_wftask_assignee ON workflow_task_run(organization_id, assignee_user_id, status);
CREATE INDEX idx_wftask_due ON workflow_task_run(organization_id, due_at, status);

-- === INVOICE ===
CREATE INDEX idx_invoice_org_status ON invoice(organization_id, status);
CREATE INDEX idx_invoice_org_approval ON invoice(organization_id, approval_status);
CREATE INDEX idx_invoice_org_payment ON invoice(organization_id, payment_status);
CREATE INDEX idx_invoice_org_due ON invoice(organization_id, due_date);
CREATE INDEX idx_invoice_org_contractor ON invoice(organization_id, contractor_id);
CREATE INDEX idx_invoice_org_contract ON invoice(organization_id, contract_id);
CREATE INDEX idx_invoice_org_received ON invoice(organization_id, received_at);
CREATE INDEX idx_invoice_org_duphash ON invoice(organization_id, duplicate_check_hash);
CREATE INDEX idx_invoice_org_seller_taxid ON invoice(organization_id, seller_tax_id);

-- Duplicate detection unique (careful — handle edge cases in app)
-- Not a hard unique because same contractor can reissue corrected invoice with same number
CREATE INDEX idx_invoice_dedup ON invoice(organization_id, invoice_number, seller_tax_id, total_amount);

-- === APPROVAL ===
CREATE INDEX idx_approval_flow_resource ON approval_flow(organization_id, resource_type, resource_id);
CREATE INDEX idx_approval_flow_status ON approval_flow(organization_id, status);
CREATE INDEX idx_approval_step_approver ON approval_step(organization_id, approver_user_id, status);
CREATE UNIQUE INDEX idx_approval_step_order ON approval_step(approval_flow_id, step_order);

-- === PAYMENT_RUN ===
CREATE INDEX idx_payrun_org_status ON payment_run(organization_id, status);
CREATE INDEX idx_payrun_org_created ON payment_run(organization_id, created_at);
CREATE UNIQUE INDEX idx_payrun_item_unique ON payment_run_item(payment_run_id, invoice_id);
CREATE INDEX idx_payrun_item_status ON payment_run_item(organization_id, status);
CREATE INDEX idx_payrun_item_invoice ON payment_run_item(organization_id, invoice_id);

-- === INTEGRATION ===
CREATE INDEX idx_integration_sync ON integration_sync_log(organization_id, integration_connection_id, started_at);

-- === AUDIT LOG (partitioned by month recommended) ===
CREATE INDEX idx_audit_resource ON audit_log(organization_id, resource_type, resource_id, created_at);
CREATE INDEX idx_audit_actor ON audit_log(organization_id, actor_id, created_at);
CREATE INDEX idx_audit_created ON audit_log(organization_id, created_at);

-- === NOTIFICATION ===
CREATE INDEX idx_notification_user ON notification(organization_id, user_id, status);

-- === REMINDER ===
CREATE INDEX idx_reminder_scheduled ON reminder_instance(organization_id, scheduled_for, status);

-- === OUTBOX ===
CREATE INDEX idx_outbox_poll ON outbox_event(organization_id, status, available_at);

-- === COMMENT (new) ===
CREATE INDEX idx_comment_entity ON comment(organization_id, entity_type, entity_id, created_at);
```

---

## 7. Prisma Schema

Poniżej **poprawiony** Prisma schema z nałożonymi korektami.

> Zmiany vs oryginał oznaczone komentarzem `// [FIXED]` lub `// [ADDED]`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// IDENTITY & TENANT
// ============================================================

model Organization {
  id                  String   @id @default(uuid())
  slug                String   @unique
  name                String
  legalName           String?
  countryCode         String   @db.Char(2)
  defaultCurrency     String   @db.Char(3)
  timezone            String
  language            String
  fiscalYearStartMonth Int?    @default(1) // [ADDED]
  status              OrganizationStatus
  billingEmail        String?
  settingsJson        Json?    // [ADDED] feature flags, defaults
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?

  // Relations omitted for brevity — same as original
  // All child entities have organization_id FK back to this model
}

model User {
  id             String   @id @default(uuid())
  organizationId String
  email          String
  firstName      String
  lastName       String
  displayName    String
  jobTitle       String?
  status         UserStatus
  avatarUrl      String?
  lastLoginAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  organization   Organization @relation(fields: [organizationId], references: [id])

  // Relations to owned/assigned entities (same as original)

  @@unique([organizationId, email])
  @@index([organizationId, status])
}

model UserRoleAssignment {
  id             String    @id @default(uuid())
  organizationId String
  userId         String
  role           UserRole
  scopeType      ScopeType?
  scopeId        String?
  createdAt      DateTime  @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User         @relation(fields: [userId], references: [id])

  @@index([organizationId, userId])
  @@index([organizationId, role])
}

// ============================================================
// ORGANIZATIONAL STRUCTURE
// ============================================================

model Team {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  code           String?
  managerUserId  String?
  status         SimpleStatus
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  manager        User?        @relation("TeamManager", fields: [managerUserId], references: [id])

  @@index([organizationId, status])
}

model Project {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  code           String?
  teamId         String?
  status         SimpleStatus
  startDate      DateTime?
  endDate        DateTime?
  budgetAmount   Decimal?  @db.Decimal(18,2) // [ADDED]
  budgetCurrency String?   @db.Char(3)       // [ADDED]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  team           Team?        @relation(fields: [teamId], references: [id])

  @@index([organizationId, status])
  @@index([organizationId, teamId])
}

model CostCenter {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  code           String
  status         SimpleStatus
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, code])
}

// ============================================================
// CONTRACTOR OPS
// ============================================================

model Contractor {
  id                  String   @id @default(uuid())
  organizationId      String
  type                ContractorType
  legalName           String
  displayName         String
  taxId               String?
  vatId               String?
  registrationNumber  String?
  countryCode         String   @db.Char(2)
  currency            String   @db.Char(3)
  email               String?
  phone               String?
  website             String?
  addressLine1        String?  // [ADDED]
  addressLine2        String?  // [ADDED]
  city                String?  // [ADDED]
  postalCode          String?  // [ADDED]
  status              ContractorStatus
  lifecycleStage      ContractorLifecycleStage
  ownerUserId         String?
  primaryTeamId       String?
  primaryProjectId    String?
  defaultCostCenterId String?
  notes               String?
  isSensitive         Boolean  @default(false)
  customFieldsJson    Json?    // [ADDED]
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  archivedAt          DateTime?
  deletedAt           DateTime?

  organization        Organization @relation(fields: [organizationId], references: [id])
  owner               User?        @relation("ContractorOwner", fields: [ownerUserId], references: [id])
  primaryTeam         Team?        @relation(fields: [primaryTeamId], references: [id])
  primaryProject      Project?     @relation(fields: [primaryProjectId], references: [id])
  defaultCostCenter   CostCenter?  @relation(fields: [defaultCostCenterId], references: [id])

  contacts            ContractorContact[]
  billingProfiles     ContractorBillingProfile[]
  assignments         ContractorAssignment[]
  contracts           Contract[]
  complianceItems     ContractorComplianceItem[]
  workflowRuns        WorkflowRun[]
  invoices            Invoice[]
  paymentRunItems     PaymentRunItem[]  // [ADDED] missing back-relation
  tags                ContractorTagLink[]  // [ADDED] missing relation

  @@index([organizationId, status])
  @@index([organizationId, lifecycleStage])
  @@index([organizationId, ownerUserId])
  @@index([organizationId, legalName])
  @@index([organizationId, taxId])
}

model ContractorContact {
  id             String   @id @default(uuid())
  organizationId String
  contractorId   String
  fullName       String
  email          String
  phone          String?
  roleTitle      String?
  isPrimary      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  contractor     Contractor   @relation(fields: [contractorId], references: [id])

  @@index([organizationId, contractorId])
}

model ContractorBillingProfile {
  id                   String   @id @default(uuid())
  organizationId       String
  contractorId         String
  legalEntityName      String
  billingEmail         String?
  countryCode          String   @db.Char(2)
  addressLine1         String?
  addressLine2         String?
  city                 String?
  postalCode           String?
  bankAccountMasked    String?
  bankAccountEncrypted String?
  bankName             String?
  swiftBic             String?  @db.VarChar(11)  // [FIXED] SWIFT = max 11 chars
  preferredCurrency    String   @db.Char(3)
  paymentTermsDays     Int?
  taxId                String?
  vatId                String?
  isDefault            Boolean  @default(false)
  validFrom            DateTime @db.Date
  validTo              DateTime? @db.Date
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  organization         Organization @relation(fields: [organizationId], references: [id])
  contractor           Contractor   @relation(fields: [contractorId], references: [id])

  invoices             Invoice[]
  paymentRunItems      PaymentRunItem[]

  @@index([organizationId, contractorId])
  @@index([organizationId, isDefault])
}

model ContractorAssignment {
  id                String   @id @default(uuid())
  organizationId    String
  contractorId      String
  teamId            String?
  projectId         String?
  costCenterId      String?
  ownerUserId       String?
  allocationPercent Decimal? @db.Decimal(5,2)
  activeFrom        DateTime @db.Date
  activeTo          DateTime? @db.Date
  status            AssignmentStatus
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])
  contractor        Contractor   @relation(fields: [contractorId], references: [id])
  team              Team?        @relation(fields: [teamId], references: [id])
  project           Project?     @relation(fields: [projectId], references: [id])
  costCenter        CostCenter?  @relation(fields: [costCenterId], references: [id])

  @@index([organizationId, contractorId, status])
}

// [ADDED] Tag models — were described but missing from Prisma schema
model ContractorTag {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  color          String?  @db.VarChar(7)
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  contractors    ContractorTagLink[]

  @@unique([organizationId, name])
}

model ContractorTagLink {
  contractorId String
  tagId        String

  contractor   Contractor    @relation(fields: [contractorId], references: [id])
  tag          ContractorTag @relation(fields: [tagId], references: [id])

  @@id([contractorId, tagId])
}

// ============================================================
// CONTRACTS & DOCUMENTS
// ============================================================

model Contract {
  id                           String   @id @default(uuid())
  organizationId               String
  contractorId                 String
  contractNumber               String?
  title                        String
  type                         ContractType
  status                       ContractStatus
  startDate                    DateTime @db.Date
  endDate                      DateTime? @db.Date
  noticePeriodDays             Int?
  autoRenewal                  Boolean  @default(false)
  renewalTerms                 String?
  currency                     String   @db.Char(3)
  billingModel                 BillingModel
  rateType                     RateType
  rateValue                    Decimal? @db.Decimal(18,2)
  expectedHoursPerPeriod       Decimal? @db.Decimal(10,2)
  retainerAmount               Decimal? @db.Decimal(18,2)
  paymentTermsDays             Int?
  invoiceCycle                 InvoiceCycle?
  expenseReimbursementAllowed  Boolean  @default(false)
  requiresTimesheet            Boolean  @default(false)
  requiresDeliverableAcceptance Boolean @default(false)
  internalOwnerUserId          String?
  teamId                       String?
  projectId                    String?
  costCenterId                 String?
  complianceRiskLevel          ComplianceRiskLevel?
  notes                        String?
  signedAt                     DateTime?
  terminatedAt                 DateTime?
  terminationReason            String?
  metadataJson                 Json?    // [ADDED]
  createdAt                    DateTime @default(now())
  updatedAt                    DateTime @updatedAt
  deletedAt                    DateTime?

  organization                 Organization @relation(fields: [organizationId], references: [id])
  contractor                   Contractor   @relation(fields: [contractorId], references: [id])
  internalOwner                User?        @relation("ContractOwner", fields: [internalOwnerUserId], references: [id])
  team                         Team?        @relation(fields: [teamId], references: [id])
  project                      Project?     @relation(fields: [projectId], references: [id])
  costCenter                   CostCenter?  @relation(fields: [costCenterId], references: [id])

  amendments                   ContractAmendment[]
  ratePeriods                  ContractRatePeriod[]
  complianceItems              ContractorComplianceItem[]
  invoices                     Invoice[]
  workflowRuns                 WorkflowRun[]  // [ADDED] missing back-relation

  @@index([organizationId, contractorId, status])
  @@index([organizationId, endDate])
  @@index([organizationId, internalOwnerUserId])
  @@index([organizationId, status])  // [ADDED] for expiring contracts query
}

model ContractAmendment {
  id                String   @id @default(uuid())
  organizationId    String
  contractId        String
  amendmentNumber   String?
  title             String
  effectiveDate     DateTime @db.Date
  description       String?
  changesSummaryJson Json
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])
  contract          Contract     @relation(fields: [contractId], references: [id])

  @@index([organizationId, contractId])
}

model ContractRatePeriod {
  id             String   @id @default(uuid())
  organizationId String
  contractId     String
  rateType       RateType
  rateValue      Decimal  @db.Decimal(18,2)
  currency       String   @db.Char(3)
  validFrom      DateTime @db.Date
  validTo        DateTime? @db.Date
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  contract       Contract     @relation(fields: [contractId], references: [id])

  @@index([organizationId, contractId])
  @@index([organizationId, validFrom, validTo])
}

model Document {
  id                String   @id @default(uuid())
  organizationId    String
  storageKey        String
  originalFileName  String
  mimeType          String
  fileSizeBytes     BigInt           // [FIXED] was Int — BigInt for files >2GB
  checksumSha256    String   @db.VarChar(64)  // [FIXED] SHA-256 = exactly 64 hex chars
  documentType      DocumentType
  status            DocumentStatus
  visibility        DocumentVisibility
  uploadedByUserId  String?
  source            DocumentSource
  virusScanStatus   VirusScanStatus
  encrypted         Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  organization      Organization @relation(fields: [organizationId], references: [id])
  links             DocumentLink[]
  invoiceFiles      InvoiceFile[]
  paymentExports    PaymentExport[]

  @@index([organizationId, documentType, status])
  @@index([organizationId, checksumSha256])
}

model DocumentLink {
  id             String   @id @default(uuid())
  organizationId String
  documentId     String
  entityType     EntityType
  entityId       String
  linkRole       DocumentLinkRole
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  document       Document     @relation(fields: [documentId], references: [id])

  @@index([organizationId, entityType, entityId])
  @@index([organizationId, documentId])
}

model ComplianceRequirementTemplate {
  id                       String   @id @default(uuid())
  organizationId           String
  name                     String
  appliesToContractorType  ContractorType?
  documentType             DocumentType
  isRequired               Boolean
  expires                  Boolean
  defaultValidityDays      Int?
  createdAt                DateTime @default(now())

  organization             Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
}

model ContractorComplianceItem {
  id                      String   @id @default(uuid())
  organizationId          String
  contractorId            String
  contractId              String?
  requirementTemplateId   String?
  name                    String
  documentType            DocumentType
  status                  ComplianceStatus
  dueDate                 DateTime? @db.Date
  satisfiedByDocumentId   String?
  expiresAt               DateTime? @db.Date
  notes                   String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  organization            Organization @relation(fields: [organizationId], references: [id])
  contractor              Contractor   @relation(fields: [contractorId], references: [id])
  contract                Contract?    @relation(fields: [contractId], references: [id])

  @@index([organizationId, contractorId, status])
  @@index([organizationId, expiresAt])
}

// ============================================================
// WORKFLOW ENGINE
// ============================================================

model WorkflowTemplate {
  id                  String   @id @default(uuid())
  organizationId      String
  name                String
  type                WorkflowTemplateType
  description         String?
  version             Int
  status              WorkflowTemplateStatus
  appliesToEntityType EntityType
  createdByUserId     String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  organization        Organization @relation(fields: [organizationId], references: [id])
  tasks               WorkflowTaskTemplate[]
  runs                WorkflowRun[]

  @@index([organizationId, type, status])
}

model WorkflowTaskTemplate {
  id                        String   @id @default(uuid())
  organizationId            String
  workflowTemplateId        String
  title                     String
  description               String?
  taskType                  WorkflowTaskType
  sortOrder                 Int
  required                  Boolean
  assigneeMode              AssigneeMode
  assigneeRole              UserRole?
  assigneeUserId            String?
  dueOffsetDays             Int?
  dueOffsetHours            Int?
  dependsOnTaskTemplateId   String?
  externalUrl               String?
  configJson                Json?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  organization              Organization @relation(fields: [organizationId], references: [id])
  workflowTemplate          WorkflowTemplate @relation(fields: [workflowTemplateId], references: [id])

  @@index([organizationId, workflowTemplateId, sortOrder])
}

model WorkflowRun {
  id                 String   @id @default(uuid())
  organizationId     String
  workflowTemplateId String
  entityType         EntityType
  entityId           String
  contractorId       String?
  contractId         String?
  status             WorkflowRunStatus
  startedByUserId    String
  startedAt          DateTime @default(now())
  dueAt              DateTime?
  completedAt        DateTime?
  cancelledAt        DateTime?
  cancelReason       String?
  progressPercent    Int?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  organization       Organization     @relation(fields: [organizationId], references: [id])
  workflowTemplate   WorkflowTemplate @relation(fields: [workflowTemplateId], references: [id])
  contractor         Contractor?      @relation(fields: [contractorId], references: [id])
  contract           Contract?        @relation(fields: [contractId], references: [id])
  startedBy          User             @relation("WorkflowRunStarter", fields: [startedByUserId], references: [id])

  tasks              WorkflowTaskRun[]
  comments           WorkflowComment[]
  attachments        WorkflowAttachment[]  // [ADDED]

  @@index([organizationId, status])
  @@index([organizationId, contractorId])
  @@index([organizationId, entityType, entityId])
  @@index([organizationId, dueAt])
}

model WorkflowTaskRun {
  id                     String   @id @default(uuid())
  organizationId         String
  workflowRunId          String
  workflowTaskTemplateId String?
  title                  String
  description            String?
  taskType               WorkflowTaskType
  status                 WorkflowTaskStatus
  required               Boolean
  assigneeUserId         String?
  assigneeRole           UserRole?
  dueAt                  DateTime?
  startedAt              DateTime?
  completedAt            DateTime?
  completedByUserId      String?
  dependsOnTaskRunId     String?
  resultJson             Json?
  externalRefType        String?
  externalRefId          String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  organization           Organization @relation(fields: [organizationId], references: [id])
  workflowRun            WorkflowRun  @relation(fields: [workflowRunId], references: [id])
  assignee               User?        @relation("WorkflowTaskAssignee", fields: [assigneeUserId], references: [id])
  completedBy            User?        @relation("WorkflowTaskCompleter", fields: [completedByUserId], references: [id])

  @@index([organizationId, workflowRunId, status])
  @@index([organizationId, assigneeUserId, status])
  @@index([organizationId, dueAt, status])
}

model WorkflowComment {
  id                String   @id @default(uuid())
  organizationId    String
  workflowRunId     String
  workflowTaskRunId String?
  authorUserId      String
  body              String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])
  workflowRun       WorkflowRun  @relation(fields: [workflowRunId], references: [id])

  @@index([organizationId, workflowRunId])
}

// [ADDED] Was described in section 4.26 but missing from Prisma schema
model WorkflowAttachment {
  id                String   @id @default(uuid())
  organizationId    String
  workflowRunId     String
  workflowTaskRunId String?
  documentId        String
  createdAt         DateTime @default(now())

  organization      Organization @relation(fields: [organizationId], references: [id])
  workflowRun       WorkflowRun  @relation(fields: [workflowRunId], references: [id])
  document          Document     @relation(fields: [documentId], references: [id])

  @@index([organizationId, workflowRunId])
}

// ============================================================
// FINANCE OPS
// ============================================================

model Invoice {
  id                 String   @id @default(uuid())
  organizationId     String
  contractorId       String?
  contractId         String?
  billingProfileId   String?
  invoiceNumber      String
  externalInvoiceId  String?
  source             InvoiceSource
  sourceReference    String?
  issueDate          DateTime @db.Date
  servicePeriodStart DateTime? @db.Date
  servicePeriodEnd   DateTime? @db.Date
  dueDate            DateTime @db.Date
  currency           String   @db.Char(3)
  subtotalAmount     Decimal  @db.Decimal(18,2)
  vatRate            Decimal? @db.Decimal(5,2)   // [ADDED]
  vatAmount          Decimal? @db.Decimal(18,2)
  totalAmount        Decimal  @db.Decimal(18,2)
  withholdingAmount  Decimal? @db.Decimal(18,2)
  amountToPay        Decimal  @db.Decimal(18,2)
  sellerTaxId        String?  @db.VarChar(50)    // [ADDED] critical for matching
  sellerName         String?  @db.VarChar(500)   // [ADDED]
  sellerBankAccount  String?  @db.VarChar(34)    // [ADDED] IBAN validation
  buyerTaxId         String?  @db.VarChar(50)    // [ADDED] our org NIP
  status             InvoiceStatus
  matchStatus        InvoiceMatchStatus
  approvalStatus     ApprovalStatus
  paymentStatus      PaymentStatus
  duplicateCheckHash String?  @db.VarChar(64)
  receivedAt         DateTime @default(now())
  reviewedAt         DateTime?
  approvedAt         DateTime?
  readyForPaymentAt  DateTime?
  paidAt             DateTime?
  rejectedAt         DateTime?
  rejectionReason    String?
  submittedByEmail   String?
  notes              String?
  flagsJson          Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  deletedAt          DateTime?

  organization       Organization @relation(fields: [organizationId], references: [id])
  contractor         Contractor?  @relation(fields: [contractorId], references: [id])
  contract           Contract?    @relation(fields: [contractId], references: [id])
  billingProfile     ContractorBillingProfile? @relation(fields: [billingProfileId], references: [id])

  files              InvoiceFile[]
  lines              InvoiceLine[]
  matchResults       InvoiceMatchResult[]
  paymentRunItems    PaymentRunItem[]

  @@index([organizationId, status])
  @@index([organizationId, approvalStatus])
  @@index([organizationId, paymentStatus])
  @@index([organizationId, dueDate])
  @@index([organizationId, contractorId])
  @@index([organizationId, contractId])
  @@index([organizationId, receivedAt])
  @@index([organizationId, duplicateCheckHash])
  @@index([organizationId, sellerTaxId])  // [ADDED]
}

model InvoiceFile {
  id             String   @id @default(uuid())
  organizationId String
  invoiceId      String
  documentId     String
  role           InvoiceFileRole
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  invoice        Invoice      @relation(fields: [invoiceId], references: [id])
  document       Document     @relation(fields: [documentId], references: [id])

  @@index([organizationId, invoiceId])
}

model InvoiceLine {
  id             String   @id @default(uuid())
  organizationId String
  invoiceId      String
  lineNumber     Int
  description    String
  quantity       Decimal? @db.Decimal(18,4)
  unit           String?
  unitPrice      Decimal? @db.Decimal(18,4)
  netAmount      Decimal? @db.Decimal(18,2)
  vatRate        Decimal? @db.Decimal(5,2)
  vatAmount      Decimal? @db.Decimal(18,2)
  grossAmount    Decimal? @db.Decimal(18,2)
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  invoice        Invoice      @relation(fields: [invoiceId], references: [id])

  @@index([organizationId, invoiceId])
}

model InvoiceMatchResult {
  id                  String   @id @default(uuid())
  organizationId      String
  invoiceId           String
  matchedContractId   String?
  matchedContractorId String?
  matchScore          Decimal? @db.Decimal(5,2)
  expectedAmount      Decimal? @db.Decimal(18,2)
  expectedCurrency    String?  @db.Char(3)
  amountDelta         Decimal? @db.Decimal(18,2)
  amountDeltaPercent  Decimal? @db.Decimal(8,4)
  matchedBy           MatchBy
  status              InvoiceMatchStatus
  explanationJson     Json?
  createdAt           DateTime @default(now())
  createdByUserId     String?

  organization        Organization @relation(fields: [organizationId], references: [id])
  invoice             Invoice      @relation(fields: [invoiceId], references: [id])

  @@index([organizationId, invoiceId])
}

// [ADDED] Approval chain configuration — was missing entirely
model ApprovalChainConfig {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  resourceType   ApprovalResourceType
  isDefault      Boolean  @default(false)
  isActive       Boolean  @default(true)
  conditionsJson Json?
  stepsJson      Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, resourceType, isActive])
}

model ApprovalFlow {
  id               String   @id @default(uuid())
  organizationId   String
  resourceType     EntityType
  resourceId       String
  chainConfigId    String?          // [ADDED] link to config that spawned this flow
  status           ApprovalStatus
  currentStepOrder Int?
  startedAt        DateTime @default(now())
  completedAt      DateTime?
  cancelledAt      DateTime?
  createdByUserId  String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])
  createdBy        User         @relation("ApprovalFlowCreator", fields: [createdByUserId], references: [id])

  steps            ApprovalStep[]

  @@index([organizationId, resourceType, resourceId])
  @@index([organizationId, status])
}

model ApprovalStep {
  id               String   @id @default(uuid())
  organizationId   String
  approvalFlowId   String
  stepOrder        Int
  name             String
  approverUserId   String?
  approverRole     UserRole?
  status           ApprovalStatus
  required         Boolean
  slaDeadline      DateTime?        // [ADDED] SLA timer
  actedAt          DateTime?
  decision         ApprovalDecisionType?
  comment          String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])
  approvalFlow     ApprovalFlow @relation(fields: [approvalFlowId], references: [id])
  approver         User?        @relation("ApprovalStepApprover", fields: [approverUserId], references: [id])

  decisions        ApprovalDecision[]

  @@unique([approvalFlowId, stepOrder])
  @@index([organizationId, approverUserId, status])
}

model ApprovalDecision {
  id               String   @id @default(uuid())
  organizationId   String
  approvalStepId   String
  actorUserId      String
  decision         ApprovalDecisionType
  comment          String?
  createdAt        DateTime @default(now())

  organization     Organization @relation(fields: [organizationId], references: [id])
  approvalStep     ApprovalStep @relation(fields: [approvalStepId], references: [id])
  actor            User         @relation(fields: [actorUserId], references: [id])

  @@index([organizationId, approvalStepId])
}

model PaymentRun {
  id               String   @id @default(uuid())
  organizationId   String
  runNumber        String?
  name             String?          // [ADDED] e.g., "March 2026 - PLN"
  status           PaymentRunStatus
  currency         String?  @db.Char(3)
  createdByUserId  String
  approvedByUserId String?
  totalAmount      Decimal  @default(0) @db.Decimal(18,2)
  invoiceCount     Int      @default(0)
  exportFormat     PaymentExportFormat?
  exportedAt       DateTime?
  completedAt      DateTime?
  failedAt         DateTime?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])
  createdBy        User         @relation("PaymentRunCreator", fields: [createdByUserId], references: [id])
  approvedBy       User?        @relation("PaymentRunApprover", fields: [approvedByUserId], references: [id])

  items            PaymentRunItem[]
  exports          PaymentExport[]

  @@index([organizationId, status])
  @@index([organizationId, createdAt])
}

model PaymentRunItem {
  id               String   @id @default(uuid())
  organizationId   String
  paymentRunId     String
  invoiceId        String
  contractorId     String
  billingProfileId String?
  amount           Decimal  @db.Decimal(18,2)
  currency         String   @db.Char(3)
  status           PaymentRunItemStatus
  paymentReference String?
  markedPaidAt     DateTime?
  failureReason    String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])
  paymentRun       PaymentRun   @relation(fields: [paymentRunId], references: [id])
  invoice          Invoice      @relation(fields: [invoiceId], references: [id])
  contractor       Contractor   @relation(fields: [contractorId], references: [id])
  billingProfile   ContractorBillingProfile? @relation(fields: [billingProfileId], references: [id])

  @@unique([paymentRunId, invoiceId])
  @@index([organizationId, status])
  @@index([organizationId, invoiceId])
}

model PaymentExport {
  id                String   @id @default(uuid())
  organizationId    String
  paymentRunId      String
  documentId        String?
  format            PaymentExportFormat
  status            ExportStatus
  generatedByUserId String
  generatedAt       DateTime @default(now())
  downloadedAt      DateTime?

  organization      Organization @relation(fields: [organizationId], references: [id])
  paymentRun        PaymentRun   @relation(fields: [paymentRunId], references: [id])
  document          Document?    @relation(fields: [documentId], references: [id])

  @@index([organizationId, paymentRunId])
}

// ============================================================
// INTEGRATIONS
// ============================================================

model IntegrationConnection {
  id                String   @id @default(uuid())
  organizationId    String
  provider          IntegrationProvider
  status            IntegrationStatus
  displayName       String?
  configJson        Json?
  credentialsRef    String
  connectedByUserId String
  connectedAt       DateTime @default(now())
  lastSyncAt        DateTime?
  lastSuccessAt     DateTime?
  lastErrorAt       DateTime?
  lastErrorMessage  String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization      Organization @relation(fields: [organizationId], references: [id])
  connectedBy       User         @relation(fields: [connectedByUserId], references: [id])

  externalLinks     ExternalLink[]
  syncLogs          IntegrationSyncLog[]

  @@index([organizationId, provider, status])
}

model ExternalLink {
  id                      String   @id @default(uuid())
  organizationId          String
  integrationConnectionId String
  entityType              EntityType
  entityId                String
  externalType            String
  externalId              String
  externalUrl             String?
  metadataJson            Json?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  organization            Organization @relation(fields: [organizationId], references: [id])
  integrationConnection   IntegrationConnection @relation(fields: [integrationConnectionId], references: [id])

  @@index([organizationId, entityType, entityId])
  @@index([organizationId, integrationConnectionId])
}

model IntegrationSyncLog {
  id                      String   @id @default(uuid())
  organizationId          String
  integrationConnectionId String
  direction               SyncDirection
  syncType                String
  entityType              EntityType?
  entityId                String?
  status                  SyncStatus
  requestPayloadJson      Json?
  responsePayloadJson     Json?
  errorMessage            String?
  startedAt               DateTime @default(now())
  completedAt             DateTime?

  organization            Organization @relation(fields: [organizationId], references: [id])
  integrationConnection   IntegrationConnection @relation(fields: [integrationConnectionId], references: [id])

  @@index([organizationId, integrationConnectionId, startedAt])
  @@index([organizationId, status])
}

model WebhookDelivery {
  id                      String   @id @default(uuid())
  organizationId          String
  integrationConnectionId String?
  provider                IntegrationProvider
  eventType               String
  deliveryStatus          WebhookDeliveryStatus
  signatureValid          Boolean?
  payloadJson             Json
  receivedAt              DateTime @default(now())
  processedAt             DateTime?
  errorMessage            String?

  organization            Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, provider, receivedAt])
}

// ============================================================
// COMMUNICATION
// ============================================================

model Notification {
  id             String   @id @default(uuid())
  organizationId String
  userId         String
  channel        NotificationChannel
  type           String
  title          String
  body           String
  entityType     EntityType?
  entityId       String?
  status         NotificationStatus
  sentAt         DateTime?
  readAt         DateTime?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User         @relation(fields: [userId], references: [id])

  @@index([organizationId, userId, status])
}

// [ADDED] User notification preferences — was in PRD but missing from data model
model UserNotificationPreference {
  id               String   @id @default(uuid())
  userId           String
  organizationId   String
  notificationType String
  channelEmail     Boolean  @default(true)
  channelSlack     Boolean  @default(true)
  channelInApp     Boolean  @default(true)
  digestMode       Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user             User         @relation(fields: [userId], references: [id])
  organization     Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, notificationType])
}

// [ADDED] Polymorphic comments — not just workflow, but any entity
model Comment {
  id             String   @id @default(uuid())
  organizationId String
  entityType     EntityType
  entityId       String
  authorUserId   String
  body           String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  author         User         @relation(fields: [authorUserId], references: [id])

  @@index([organizationId, entityType, entityId, createdAt])
}

model ReminderRule {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  entityType     EntityType
  triggerType    ReminderTriggerType
  offsetDays     Int?
  offsetHours    Int?
  channel        NotificationChannel
  recipientMode  RecipientMode
  configJson     Json?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, active])
}

model ReminderInstance {
  id             String   @id @default(uuid())
  organizationId String
  reminderRuleId String
  entityType     EntityType
  entityId       String
  scheduledFor   DateTime
  status         ReminderInstanceStatus
  sentAt         DateTime?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, scheduledFor, status])
}

// ============================================================
// AUDIT & EVENTS
// ============================================================

model AuditLog {
  id             String   @id @default(uuid())
  organizationId String
  actorType      ActorType
  actorId        String?
  actorName      String?          // [ADDED] denormalized for immutability
  action         String
  resourceType   EntityType
  resourceId     String
  resourceName   String?          // [ADDED] denormalized
  oldValuesJson  Json?
  newValuesJson  Json?
  metadataJson   Json?
  ipAddress      String?
  userAgent      String?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])

  // No updatedAt — audit logs are immutable
  @@index([organizationId, resourceType, resourceId, createdAt])
  @@index([organizationId, actorId, createdAt])
  @@index([organizationId, createdAt])
}

model OutboxEvent {
  id             String   @id @default(uuid())
  organizationId String
  eventType      String
  aggregateType  String
  aggregateId    String
  payloadJson    Json
  status         OutboxStatus
  availableAt    DateTime
  publishedAt    DateTime?
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId, status, availableAt])
}

// ============================================================
// ENUMS
// ============================================================

enum OrganizationStatus {
  ACTIVE
  SUSPENDED
  TRIAL
  ARCHIVED
}

enum UserStatus {
  INVITED
  ACTIVE
  DISABLED
  ARCHIVED
}

enum UserRole {
  ORG_ADMIN
  FINANCE_ADMIN
  OPS_MANAGER
  TEAM_MANAGER
  LEGAL_VIEWER
  IT_ADMIN
  ACCOUNTANT
  READ_ONLY
}

enum ScopeType {
  ORGANIZATION
  TEAM
  PROJECT
  COST_CENTER
}

enum SimpleStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum ContractorType {
  SOLE_TRADER
  COMPANY
  INDIVIDUAL_FREELANCER
  OTHER
}

enum ContractorStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum ContractorLifecycleStage {
  DRAFT
  ONBOARDING
  ACTIVE
  OFFBOARDING
  ENDED
}

enum AssignmentStatus {
  ACTIVE
  ENDED
  PLANNED
}

enum ContractType {
  B2B_MASTER_SERVICE
  STATEMENT_OF_WORK
  NDA
  IP_ASSIGNMENT
  DPA
  OTHER
}

enum ContractStatus {
  DRAFT
  PENDING_SIGNATURE
  ACTIVE
  EXPIRING           // [ADDED]
  EXPIRED
  TERMINATED
  SUPERSEDED
  ARCHIVED
}

enum BillingModel {
  MONTHLY_RETAINER
  HOURLY
  DAILY
  MILESTONE
  DELIVERABLE_BASED
  MIXED
}

enum RateType {
  MONTHLY_FIXED
  PER_HOUR
  PER_DAY
  PER_MILESTONE
  PER_DELIVERABLE
}

enum InvoiceCycle {
  WEEKLY
  BIWEEKLY
  MONTHLY
  ON_DELIVERABLE
  AD_HOC
}

enum ComplianceRiskLevel {
  LOW
  MEDIUM
  HIGH
}

enum DocumentType {
  MASTER_CONTRACT
  AMENDMENT
  NDA
  IP_ASSIGNMENT
  DPA
  TAX_CERTIFICATE
  BUSINESS_REGISTRATION
  INVOICE
  TIMESHEET
  DELIVERABLE_ACCEPTANCE
  PAYMENT_EXPORT
  INSURANCE           // [ADDED]
  OTHER
}

enum DocumentStatus {
  ACTIVE
  SUPERSEDED
  EXPIRED
  ARCHIVED
}

enum DocumentVisibility {
  PRIVATE
  INTERNAL
  SHARED_WITH_ACCOUNTANT
}

enum DocumentSource {
  USER_UPLOAD
  EMAIL_INTAKE
  ESIGN
  KSEF
  API
  GENERATED
}

enum VirusScanStatus {
  PENDING
  CLEAN
  INFECTED
  FAILED
}

enum EntityType {
  ORGANIZATION
  CONTRACTOR
  CONTRACT
  DOCUMENT
  INVOICE
  WORKFLOW_RUN
  WORKFLOW_TASK_RUN
  PAYMENT_RUN
  PROJECT
  TEAM
  APPROVAL_FLOW      // [ADDED]
}

enum DocumentLinkRole {
  PRIMARY
  SUPPORTING
  GENERATED_OUTPUT
  SIGNED_COPY
}

enum ComplianceStatus {
  MISSING
  PENDING
  SATISFIED
  EXPIRED
  WAIVED
}

enum WorkflowTemplateType {
  ONBOARDING
  OFFBOARDING
  DOCUMENT_COLLECTION
  COMPLIANCE_REVIEW
  CUSTOM
}

enum WorkflowTemplateStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum WorkflowTaskType {
  DOCUMENT_COLLECTION
  APPROVAL
  ACCESS_GRANT
  ACCESS_REVOKE
  FINANCE_SETUP
  EQUIPMENT
  KNOWLEDGE_TRANSFER
  MEETING
  MANUAL
  NOTIFICATION         // [ADDED]
}

enum AssigneeMode {
  FIXED_USER
  ROLE_BASED
  CONTRACTOR_OWNER
  CONTRACT_OWNER
  PROJECT_MANAGER
}

enum WorkflowRunStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  BLOCKED
  OVERDUE
}

enum WorkflowTaskStatus {
  TODO
  IN_PROGRESS
  DONE
  BLOCKED
  SKIPPED
  CANCELLED
  OVERDUE
}

enum InvoiceSource {
  MANUAL_UPLOAD
  EMAIL_INTAKE
  KSEF
  API
}

enum InvoiceStatus {
  RECEIVED
  UNDER_REVIEW
  APPROVAL_PENDING
  APPROVED
  REJECTED
  READY_FOR_PAYMENT
  PARTIALLY_PAID
  PAID
  VOID
}

enum InvoiceMatchStatus {
  UNMATCHED
  PARTIAL
  MATCHED
  DISCREPANCY
  MANUALLY_CONFIRMED
}

enum InvoiceFileRole {
  SOURCE_ORIGINAL
  PARSED_COPY
  SUPPORTING_ATTACHMENT
  CORRECTION
}

enum ApprovalStatus {
  NOT_STARTED
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum ApprovalResourceType {
  INVOICE
  DOCUMENT
  CONTRACT
}

enum ApprovalDecisionType {
  APPROVE
  REJECT
  REQUEST_CHANGES
  DELEGATE
}

enum PaymentStatus {
  NOT_READY
  READY
  IN_RUN
  PARTIALLY_PAID
  PAID
  FAILED
}

enum PaymentRunStatus {
  DRAFT
  LOCKED
  EXPORTED
  COMPLETED
  FAILED
  CANCELLED
}

enum PaymentRunItemStatus {
  PENDING
  EXPORTED
  PAID
  FAILED
  SKIPPED
}

enum PaymentExportFormat {
  CSV
  BANK_FILE
  SEPA_XML             // [ADDED]
  MT940                // [ADDED]
  XML
  API_PUSH
}

enum ExportStatus {
  GENERATED
  DOWNLOADED
  FAILED
}

enum MatchBy {
  RULE_ENGINE
  MANUAL
  INTEGRATION
  OCR_EXTRACTION
}

enum IntegrationProvider {
  SLACK
  GOOGLE_WORKSPACE
  MICROSOFT_365
  JIRA
  ESIGN
  KSEF
  ACCOUNTING
  OPEN_BANKING
  GITHUB
  GITLAB
}

enum IntegrationStatus {
  CONNECTED
  DISCONNECTED
  ERROR
  REAUTH_REQUIRED
}

enum SyncDirection {
  INBOUND
  OUTBOUND
}

enum SyncStatus {
  STARTED
  SUCCESS
  FAILED
}

enum WebhookDeliveryStatus {
  RECEIVED
  PROCESSED
  FAILED
}

enum NotificationChannel {
  IN_APP
  EMAIL
  SLACK
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  READ
}

enum ReminderTriggerType {
  BEFORE_DUE_DATE
  ON_DUE_DATE
  AFTER_DUE_DATE
  BEFORE_CONTRACT_END
  BEFORE_DOCUMENT_EXPIRY
  ON_LIFECYCLE_CHANGE    // [ADDED]
}

enum RecipientMode {
  ENTITY_OWNER
  FINANCE_TEAM
  ASSIGNEE
  SPECIFIC_USER
  ROLE
}

enum ReminderInstanceStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}

enum ActorType {
  USER
  SYSTEM
  INTEGRATION
  API_KEY              // [ADDED]
}

enum OutboxStatus {
  PENDING
  PUBLISHED
  FAILED
}
```

---

## 8. ⚠️ Korekty względem oryginału

Poniżej kompletna lista poprawek i uzupełnień nałożonych na oryginalny data model GPT.

### 🔴 Krytyczne poprawki

| #   | Problem                                                                                                                                    | Poprawka                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 1   | **Invoice brakował pól seller_tax_id, seller_name, seller_bank_account, buyer_tax_id** — bez nich matching po NIP nie działa               | Dodane 4 pola na Invoice          |
| 2   | **ApprovalChainConfig — brakująca encja** — system miał runtime ApprovalFlow/Step, ale żadnego template'u definiującego ścieżkę akceptacji | Dodany model ApprovalChainConfig  |
| 3   | **ContractorTag + ContractorTagLink — opisane w sekcji 4.11/4.12, ale brakujące w Prisma schema**                                          | Dodane modele + UNIQUE constraint |
| 4   | **WorkflowAttachment — opisany w sekcji 4.26, brakujący w Prisma schema**                                                                  | Dodany model                      |
| 5   | **Document.fileSizeBytes = Int** — przepełnienie przy plikach >2GB                                                                         | Zmieniony na BigInt               |
| 6   | **Contract.status brakował EXPIRING** — potrzebny do alertów o kończących się umowach                                                      | Dodany enum value                 |

### 🟡 Istotne uzupełnienia

| #   | Problem                                                                                                            | Poprawka                     |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 7   | **UserNotificationPreference — brakująca encja** — opisana w PRD, nie istniejąca w data model                      | Dodany model                 |
| 8   | **Comment (polymorphic) — brakujący** — WorkflowComment istniał, ale komentarze na Invoice/Contractor/Contract nie | Dodany generic Comment model |
| 9   | **Contractor brakował pól adresowych** — address_line_1, city, postal_code                                         | Dodane na Contractor         |
| 10  | **Contractor brakował custom_fields_json** — extensibility                                                         | Dodane                       |
| 11  | **Contract brakował metadata_json** — extensibility                                                                | Dodane                       |
| 12  | **Invoice brakował vat_rate** — główna stawka VAT                                                                  | Dodane                       |
| 13  | **ApprovalStep brakował sla_deadline** — SLA timer na approval                                                     | Dodane                       |
| 14  | **ApprovalFlow brakował chain_config_id** — link do config template                                                | Dodane                       |
| 15  | **PaymentRun brakował name** — human-readable label                                                                | Dodane                       |
| 16  | **AuditLog brakował actor_name i resource_name** — denormalizacja dla immutability                                 | Dodane                       |
| 17  | **Organization brakował fiscal_year_start_month i settings_json**                                                  | Dodane                       |
| 18  | **Project brakował budget_amount/budget_currency** — spend tracking                                                | Dodane                       |
| 19  | **Contractor brakował back-relation paymentRunItems**                                                              | Dodane                       |
| 20  | **Contract brakował back-relation workflowRuns**                                                                   | Dodane                       |

### 🟢 Enum corrections

| #   | Zmiana                                                                                         |
| --- | ---------------------------------------------------------------------------------------------- |
| 21  | ContractStatus: dodane `EXPIRING`                                                              |
| 22  | DocumentType: dodane `INSURANCE`                                                               |
| 23  | EntityType: dodane `APPROVAL_FLOW`                                                             |
| 24  | WorkflowTaskType: dodane `NOTIFICATION`                                                        |
| 25  | PaymentExportFormat: dodane `SEPA_XML`, `MT940`                                                |
| 26  | ReminderTriggerType: dodane `ON_LIFECYCLE_CHANGE`                                              |
| 27  | ActorType: dodane `API_KEY`                                                                    |
| 28  | Dodany enum `ApprovalResourceType` (INVOICE, DOCUMENT, CONTRACT)                               |
| 29  | Document.checksumSha256: ograniczony do @db.VarChar(64)                                        |
| 30  | BillingProfile.swiftBic: ograniczony do @db.VarChar(11)                                        |
| 31  | Date fields (startDate, endDate, dueDate, validFrom, validTo): dodane `@db.Date` where missing |

---

## 9. MVP Database Scope

### Faza 1 — pierwsza migracja (MVP)

```
Organization
User
UserRoleAssignment
Team
Project
CostCenter                  ← opcjonalne, ale finance chce od razu
Contractor
ContractorBillingProfile
ContractorTag + TagLink      ← tanie, przydatne od startu
Contract
Document
DocumentLink
WorkflowTemplate
WorkflowTaskTemplate
WorkflowRun
WorkflowTaskRun
Invoice
InvoiceFile
InvoiceMatchResult
ApprovalChainConfig
ApprovalFlow
ApprovalStep
PaymentRun
PaymentRunItem
IntegrationConnection
ExternalLink
Comment
Notification
AuditLog
OutboxEvent
```

### Faza 2 — po MVP

```
ContractorContact
ContractAmendment
ContractRatePeriod
ComplianceRequirementTemplate
ContractorComplianceItem
InvoiceLine
ApprovalDecision
PaymentExport
WorkflowComment
WorkflowAttachment
UserNotificationPreference
ReminderRule
ReminderInstance
IntegrationSyncLog
WebhookDelivery
```

---

## 10. Czego nie modelować w v1

| Moduł                         | Dlaczego nie teraz                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Full timesheet engine         | Na start: attachment + expected hours + manual validation                                           |
| Legal clause engine           | Structured paragraphs of contracts = overengineering; start with document + compliance flags        |
| Full access governance        | Identities, entitlements, apps inventory, SCIM deep sync — na start task/checklista + external link |
| Vendor procurement            | Purchase orders, requisitions, budgets = scope killer                                               |
| Contractor portal auth        | Osobny auth flow, osobne permissions — v2                                                           |
| Multi-entity (legal entities) | Jeden tenant = jedna organizacja na start                                                           |

---

## 11. Decyzje architektoniczne

### A. organization_id prawie wszędzie

Tak, nawet jeśli relacja pośrednia istnieje. Dlaczego? Prostsze policy enforcement, prostsze indeksy, szybszy scoping, łatwiejsze RLS jeśli kiedyś użyjesz.

### B. Document przez Document + DocumentLink

Nie przywiązuj plików twardo do jednej encji. Jeden NDA może dotyczyć kontraktora i kontraktu jednocześnie.

### C. Approval jako osobny flow

Nie trzymaj `approved_by` tylko na Invoice. Multi-step approval wymaga komentarzy, delegacji, historii.

### D. Workflow engine light

TaskTemplates + Runs wystarczą. Nie buduj BPMN potwora. Złożoność dodaj iteracyjnie.

### E. Outbox event od dnia 1

Warto, jeśli planujesz integracje i background jobs. Transactional outbox pattern zapobiega lost events.

### F. Billing profile osobno od Contractor

Zmiany kont bankowych, różne profile rozliczeniowe, historia — to się opłaca od startu.

### G. Separation of concerns w statusach Invoice

Invoice ma osobno: `status` (overall), `match_status`, `approval_status`, `payment_status`. Czystszy model, prostsze query, lepsze dashboardy.

### H. Date fields: DATE vs TIMESTAMPTZ

- **Due dates, start/end dates, validity ranges** → `DATE` (no timezone confusion)
- **Events: created_at, completed_at, received_at** → `TIMESTAMPTZ` (store UTC, display in org timezone)

---

## 12. Pułapki

| Pułapka                        | Mitygacja                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Za dużo JSON-ów                | JSON = wsparcie, nie wymówka. Core relational data musi zostać relational.                                                                                     |
| Za dużo polymorphism           | DocumentLink i ExternalLink OK, ale nie rób wszystkiego jako generic Entity(id,type).                                                                          |
| Mieszanie statusów             | Invoice MUSI mieć osobne statusy: overall, match, approval, payment.                                                                                           |
| Brak historii stawek           | ContractRatePeriod rozwiązuje — nadpisywanie stawki w Contract to bug waiting to happen.                                                                       |
| Brak billing profile history   | Osobna tabela z valid_from/valid_to.                                                                                                                           |
| Invoice dedup jako hard UNIQUE | Nie rób `UNIQUE(org_id, invoice_number, contractor_id)` — ta sama firma może wystawić korektę z tym samym numerem. Użyj duplicate_check_hash + soft detection. |
| AuditLog z FK do User          | Denormalizuj actor_name — user może zostać usunięty, audit musi przetrwać.                                                                                     |
| BigInt vs Int na file_size     | Int overflow przy plikach >2GB. Zawsze BigInt.                                                                                                                 |

---

_Koniec dokumentu. Wersja 1.1 — zrewidowana z 31 korektami._
