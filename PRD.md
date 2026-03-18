# Contractor Ops — Product Requirements Document

**Wersja:** 1.1 (zrewidowana)
**Data:** 2026-03-18
**Status:** Draft → Review
**Autor oryginalny:** GPT / Product Owner
**Rewizja i uzupełnienia:** Claude (analiza kompletności)

> **Nazwy robocze:** Contractor Ops · Contractor Hub · B2B Workforce Ops · ContractorFlow · KontraktorOS

---

## Spis treści

1. [Streszczenie wykonawcze](#1-streszczenie-wykonawcze)
2. [Problem](#2-problem)
3. [Cel produktu](#3-cel-produktu)
4. [Co produkt jest, a czym nie jest](#4-co-produkt-jest-a-czym-nie-jest)
5. [ICP / Target Customer](#5-icp--target-customer)
6. [Core Use Cases](#6-core-use-cases)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [Information Architecture](#8-information-architecture)
9. [Szczegółowe widoki UI](#9-szczegółowe-widoki-ui)
10. [Core Processes](#10-core-processes)
11. [Wymagania funkcjonalne — moduł po module](#11-wymagania-funkcjonalne--moduł-po-module)
12. [Integracje](#12-integracje)
13. [Architektura systemu](#13-architektura-systemu)
14. [Model danych](#14-model-danych)
15. [API Contract](#15-api-contract)
16. [Security & Compliance](#16-security--compliance)
17. [MVP Scope](#17-mvp-scope)
18. [Post-MVP Roadmap](#18-post-mvp-roadmap)
19. [Non-Goals](#19-non-goals)
20. [Ryzyka](#20-ryzyka)
21. [Pozycjonowanie produktu](#21-pozycjonowanie-produktu)
22. [Product Wedge & Differentiator](#22-product-wedge--differentiator)
23. [⚠️ Gap Analysis — Brakujące elementy](#23-️-gap-analysis--brakujące-elementy)
24. [Open Questions](#24-open-questions)

---

## 1. Streszczenie wykonawcze

**One-liner:** System do zarządzania kontraktorami B2B w firmach z UE — umowy, onboarding, faktury, akceptacje, płatności i offboarding w jednym miejscu.

**Pozycjonowanie:** System operacyjny do zarządzania kontraktorami B2B dla firm 10–200 osób, które mają 5–50 kontraktorów i dziś ogarniają to przez Excel, mail, Slack, Notion i bank.

**Core flow:** kontraktor → umowa → onboarding → faktura → akceptacja → płatność → offboarding

**Nie budujemy "mini-Deel".** Budujemy wąski, głęboki, execution-grade system do lokalnych kontraktorów B2B.

**Kontekst rynkowy:** KSeF (Krajowy System e-Faktur) ruszył 1 lutego 2026 dla dużych firm, 1 kwietnia 2026 dla pozostałych. Każda firma z kontraktorami B2B musi teraz ogarnąć odbiór faktur z KSeF, matching do kontraktów, approval flow i batch payments — i dziś robi to w Excelu + mailu + banku.

---

## 2. Problem

Firmy z 5–50 kontraktorami B2B obsługują współpracę przez kilka rozproszonych narzędzi:

| Funkcja                     | Narzędzie dziś                    |
| --------------------------- | --------------------------------- |
| Lista kontraktorów i stawek | Excel / Google Sheets             |
| Faktury                     | Email / Slack / mail od księgowej |
| Akceptacje                  | Slack DM / email thread           |
| Checklists i SOP-y          | Notion                            |
| Umowy                       | Google Drive / Dropbox            |
| Płatności                   | Bank / przelew ręczny             |
| Księgowość                  | Osobny silos (biuro rachunkowe)   |

**Konsekwencje:**

- Brak jednego źródła prawdy o kontraktorach
- Zgubione lub spóźnione faktury
- Brak jasnego ownershipu akceptacji — "kto miał to zatwierdzić?"
- Chaos przy kończących się umowach — dowiadują się po fakcie
- Ręczny onboarding/offboarding — każdy robi to "jakoś"
- Ryzyko braku dokumentów po zakończeniu współpracy (NDA, IP transfer)
- Ryzyko niezablokowanego dostępu po offboardingu
- Brak pełnego audytowalnego śladu — "kto to zatwierdził i kiedy?"
- Podwójne płatności lub missed payments
- Finance traci czas na matching faktur do kontraktów ręcznie

---

## 3. Cel produktu

Zbudować operacyjny system dla pełnego lifecycle kontraktora B2B:

```
1. Dodaj kontraktora
2. Podepnij umowę i dokumenty
3. Uruchom onboarding
4. Odbierz fakturę
5. Dopasuj do kontraktu i modelu rozliczeń
6. Przekaż do akceptacji
7. Zbierz do payment run
8. Odnotuj płatność
9. Przy końcu współpracy — uruchom offboarding i zamknij konto
```

**System ma być:**

- Execution layer (nie knowledge base)
- Source of record (nie backup)
- Audit trail (nie "trust me bro")
- Coordination layer między finance, ops i managerami

---

## 4. Co produkt jest, a czym nie jest

### ✅ Jest

- Contractor ops platform
- Contractor source of record
- Workflow + approvals + audit trail engine
- Contract / invoice / payment coordination layer
- Execution layer pomiędzy finance, ops i managerami
- Notification i reminder system dla contractor lifecycle

### ❌ Nie jest

- Pełnym HRIS dla etatów
- Payroll systemem
- EOR / AOR (Employer/Agent of Record)
- Zamiennikiem Notion (Notion = knowledge base, ContractorOps = execution)
- Zamiennikiem Jira
- Zamiennikiem bankowości
- Enterprise procurement suite (SAP Fieldglass)
- Systemem księgowym all-in-one
- Vendor marketplace / freelancer discovery
- CRM

---

## 5. ICP / Target Customer

### Primary ICP

Firmy **10–200 osób**, które:

- Mają **5–50 aktywnych kontraktorów B2B**
- Pracują cyfrowo (tech-native)
- Mają finance / ops / process ownera
- Czują chaos w invoice approval i kontraktach
- Są w Polsce (pierwszy rynek), potem CEE/EU

### Idealne segmenty

| Segment                          | Dlaczego pasuje                             |
| -------------------------------- | ------------------------------------------- |
| Software houses                  | Duża baza kontraktorów, tech-savvy buyer    |
| Agencje marketingowe / creative  | Rotacja kontraktorów, project-based billing |
| Product companies z B2B staffing | Stały flow nowych kontraktorów              |
| Boutique consultancies           | Duży udział B2B w kosztach                  |
| Startupy / scaleups              | Szybko rosnąca baza kontraktorów            |

### Buyer persona

| Rola                        | Motywacja                             |
| --------------------------- | ------------------------------------- |
| COO                         | Chce porządku operacyjnego            |
| Head of Operations          | Musi ogarniać onboarding/offboarding  |
| Finance Manager             | Musi kontrolować invoices i payments  |
| Founder (10-50 osób)        | Sam robi ops + finance                |
| Office Manager / People Ops | Ogarnia dokumenty i checklisty        |
| Head of Delivery            | Potrzebuje visibility na kontraktorów |

### Pricing target

- Platform fee: **350–650 PLN/mo** (€80–150)
- Opcjonalnie: per-contractor fee
- Path to 10K MRR: 70–130 klientów
- TAM w Polsce: tysiące software house'ów i agencji

---

## 6. Core Use Cases

### UC1. Dodanie nowego kontraktora

Użytkownik dodaje kontraktora, wpisuje dane firmy/JDG, model rozliczeń, ownera, projekty, walutę. System tworzy profil i oferuje natychmiastowy start onboardingu.

**Acceptance criteria:**

- Formularz z walidacją NIP/VAT
- Automatyczne uzupełnianie danych z GUS/VIES (nice-to-have)
- Wybór billing model: retainer / hourly / milestone
- Przypisanie ownera i cost center
- Trigger onboarding workflow

### UC2. Podpisanie i przechowywanie umowy

Do kontraktora przypina się umowę, NDA, aneksy, IP transfer, DPA. System zarządza wersjami, datami i przypomnieniami.

**Acceptance criteria:**

- Upload plików (PDF, DOCX)
- Wersjonowanie dokumentów
- Daty: start, end, notice period
- Automatyczne przypomnienia przed wygaśnięciem
- Powiązanie z contractor profile

### UC3. Onboarding

System tworzy checklistę z zadaniami na podstawie template'u.

**Przykładowa checklista:**

1. Podpis dokumentów (NDA, umowa B2B)
2. Zebranie danych do faktury (NIP, konto bankowe, adres)
3. Nadanie dostępów (Slack, Jira, Google/Microsoft, GitHub)
4. Przypisanie do kanałów i projektów
5. Wydanie sprzętu (jeśli dotyczy)
6. Szkolenie / knowledge handoff
7. Welcome call completed
8. Weryfikacja pierwszego cyklu fakturowego

**Acceptance criteria:**

- Workflow uruchamiany z template'u
- Każdy task ma ownera, deadline, status, typ
- Możliwość linkowania do SOP-ów w Notion
- Progress tracking z timeline view
- Automatyczne powiadomienia o overdue tasks

### UC4. Odbiór faktury

Faktura trafia przez email, upload lub integrację (KSeF w v1.5+). System próbuje dopasować ją do kontraktora i aktywnego kontraktu.

**Acceptance criteria:**

- Upload ręczny (drag & drop, file picker)
- Intake przez dedykowany email inbox (`invoices@org.contractorhub.io`)
- Wyciąganie metadanych (OCR opcjonalnie, w v1 ręczne wpisanie)
- Automatyczny matching: contractor → contract → expected amount
- Flagowanie odchyleń (kwota, brak kontraktu, expired contract)
- Statusy: received → matched/unmatched → pending approval → approved/rejected → ready for payment → paid

### UC5. Akceptacja faktury

Manager i/lub finance zatwierdzają lub odrzucają fakturę. System pokazuje kontekst: oczekiwana kwota, kontrakt, historię.

**Acceptance criteria:**

- Definiowalne ścieżki akceptacji (1–3 poziomy)
- Approve / reject / request clarification
- Komentarze przy decyzji
- Notyfikacje (Slack, email, in-app)
- SLA timer na approval
- Pełny audit trail

### UC6. Payment run

Finance wybiera wszystkie approved invoices i eksportuje batch do banku lub systemu płatności.

**Acceptance criteria:**

- Tabela z gotowymi do zapłaty fakturami
- Filtrowanie po walucie, due date, kontraktorze
- Eksport CSV / bank file
- Oznaczanie: paid / partially paid / failed
- Payment reference tracking
- Summary card z podsumowaniem (total, count, by currency)

### UC7. Offboarding

Przy kończącej się umowie lub manualnym triggerze system uruchamia checklistę offboardingową.

**Przykładowa checklista:**

1. Revoke system access (Slack, Jira, Google, GitHub)
2. Zwrot sprzętu
3. Zamknięcie otwartych tasków
4. Final invoice — odbiór i przetworzenie
5. Knowledge transfer
6. Zamknięcie / archiwizacja kontraktora

**Acceptance criteria:**

- Automatyczny trigger przy zbliżającym się end date kontraktu
- Reminder jeśli offboarding nie został uruchomiony
- Pełna checklista z tracking
- Blokada archiwizacji jeśli otwarte taski/faktury

---

## 7. User Roles & Permissions

### Role matrix

| Rola                         | Kontraktorzy    | Kontrakty      | Workflows              | Faktury      | Approvals | Payments    | Reports  | Settings |
| ---------------------------- | --------------- | -------------- | ---------------------- | ------------ | --------- | ----------- | -------- | -------- |
| **Org Admin**                | CRUD            | CRUD           | CRUD                   | CRUD         | Full      | Full        | Full     | Full     |
| **Finance Admin**            | Read            | Read           | Read                   | CRUD         | Full      | Full        | Full     | Partial  |
| **Ops Manager**              | CRUD            | CRUD           | CRUD                   | Read/Upload  | Own queue | Read        | Full     | Partial  |
| **Team Manager**             | Read (own team) | Read (own)     | Execute                | Upload       | Own queue | —           | Own team | —        |
| **Legal/Compliance Viewer**  | Read            | Read           | Read                   | Read         | Read      | Read        | Read     | —        |
| **IT Admin**                 | Read            | —              | Execute (access tasks) | —            | —         | —           | —        | —        |
| **External Accountant**      | Read (limited)  | Read (limited) | —                      | Read/Export  | —         | Read/Export | Read     | —        |
| **Contractor Portal** _(v2)_ | Own profile     | Own docs       | Own tasks              | Own invoices | —         | Own status  | —        | —        |

### Scoping rules

- Wszystkie dane scoped do `organization_id`
- Team Manager widzi tylko kontraktorów w swoim teamie/projekcie
- External Accountant widzi tylko dane potrzebne do księgowości
- Immutable audit trail dla wszystkich zmian ról i uprawnień

---

## 8. Information Architecture

### Główne moduły

```
┌─────────────────────────────────────────────────┐
│                  CONTRACTOR OPS                  │
├─────────┬─────────┬─────────┬─────────┬─────────┤
│Dashboard│Contract-│Contracts│Workflows│ Invoices │
│         │  ors    │ & Docs  │         │         │
├─────────┼─────────┼─────────┼─────────┼─────────┤
│Approvals│Payments │ Reports │Integra- │Settings │
│         │         │         │  tions  │         │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

### Nawigacja lewa (sidebar)

1. **Dashboard** — overview, KPIs, alerts
2. **Contractors** — registry, profiles
3. **Contracts** — document repository
4. **Workflows** — onboarding / offboarding / custom
5. **Invoices** — inbox, matching, review
6. **Approvals** — queue per user
7. **Payments** — payment runs, export
8. **Reports** — spend analytics, compliance
9. **Integrations** — connected services
10. **Settings** — org, roles, templates, automations

---

## 9. Szczegółowe widoki UI

### 9.1 Dashboard

**KPI Cards (top row):**

- Active contractors (count + trend)
- Invoices awaiting approval (count + oldest)
- Ready to pay (total amount)
- Contracts expiring in 30 days (count)
- Open onboarding tasks (count)

**Main sections:**

- Spend chart — month-over-month bar/line chart
- Upcoming deadlines — contract expirations, overdue tasks, due invoices
- Approval queue widget — top 5 pending approvals
- Recent activity feed — last 20 events across the org
- Alerts widget — expired contracts, missing documents, overdue offboardings

**Quick actions (top bar or floating):**

- Add contractor
- Upload invoice
- Start payment run
- Create onboarding
- Add contract

### 9.2 Contractors List

**Table columns:**

| Kolumna               | Opis                                                    |
| --------------------- | ------------------------------------------------------- |
| Name / Company        | legal name + display name                               |
| Type                  | JDG / sole trader / company / freelancer                |
| Status                | active / onboarding / offboarding / inactive / archived |
| Team / Project        | assigned cost center                                    |
| Owner                 | internal owner                                          |
| Billing model         | retainer / hourly / milestone                           |
| Rate                  | default rate                                            |
| Currency              | PLN / EUR / USD / inne                                  |
| Next invoice expected | calculated from billing cycle                           |
| Contract end date     | nearest active contract end                             |
| Compliance health     | green / yellow / red badge                              |
| Last activity         | date of last event                                      |

**Filters:**

- Status (active / inactive / onboarding / offboarding)
- Owner
- Team / project / cost center
- Billing model
- Contract end date range
- Missing documents (compliance incomplete)
- Overdue invoice
- Country / currency

**Bulk actions:**

- Assign owner
- Send reminder
- Export (CSV, XLSX)
- Archive
- Launch workflow
- Request documents

**Search:** Full-text search across name, company, tax ID, email.

### 9.3 Contractor Profile

**Header:**

- Name + company name
- Status chip
- Contractor type
- Owner
- Action buttons: Edit · Add contract · Upload invoice · Start onboarding · Start offboarding · Mark inactive

**Tabs:**

1. **Overview** — details, billing, active contract summary, health card
2. **Contracts** — lista powiązanych kontraktów
3. **Documents** — all linked documents (NDA, DPA, IP, inne)
4. **Workflows** — onboarding/offboarding runs
5. **Invoices** — all invoices, statuses, amounts
6. **Payments** — payment history
7. **Activity** — full timeline/audit trail
8. **Compliance** — checklist wymaganych dokumentów, status

**Overview — Health card:**

- ✅ / ⚠️ / ❌ Documents complete?
- ✅ / ⚠️ / ❌ Contract expiring soon?
- ✅ / ⚠️ / ❌ Overdue tasks?
- ✅ / ⚠️ / ❌ Unpaid invoices?
- ✅ / ⚠️ / ❌ Access audit OK?

**Right rail (sticky sidebar):**

- Activity feed / timeline
- Upcoming reminders
- Related pending approvals
- Quick notes

### 9.4 Contracts Repository

**List view columns:**

- Contract name
- Contractor
- Type (B2B, NDA, IP transfer, DPA, amendment, other)
- Start date
- End date
- Notice period
- Status (active, expired, terminated, draft)
- Linked documents count
- Last updated by

**Detail view sections:**

- Summary block (parties, dates, status)
- Commercial terms (rate, currency, billing model, payment terms)
- Legal/compliance fields (required docs, IP clauses, confidentiality)
- Linked invoices
- Linked workflow templates
- Linked files (signed versions, amendments)
- Version history
- Reminders config
- Audit trail

**Actions:**

- Upload new version
- Add amendment
- Duplicate from template
- Mark superseded
- Trigger expiry workflow
- Send for e-sign (v2)

### 9.5 Workflow Template Builder

**Template types:**

- Onboarding
- Offboarding
- Document collection
- Recurring compliance review
- Custom

**Builder features:**

- Drag/drop task ordering
- Task types: document collection · approval · access grant · access revoke · finance setup · asset handoff · meeting/training · knowledge transfer · manual step
- Dependencies between tasks
- Due date offsets (relative to workflow start)
- Required vs optional tasks
- Role-based assignment (assign to role, not specific person)
- Conditional logic (light) — e.g., "if contractor type = JDG, add task X"
- Link tasks to external SOP URLs (Notion)

**Example onboarding template:**

1. Collect company details
2. Collect billing details
3. Sign NDA → depends on: #1
4. Sign B2B contract → depends on: #1, #2
5. Assign Slack channels → depends on: #4
6. Assign Jira project → depends on: #4
7. Create Google account / guest access → depends on: #4
8. Verify first invoice cycle → depends on: #2
9. Welcome call completed → depends on: #5, #6

### 9.6 Workflow Execution View

**Header:**

- Workflow name + template reference
- Status (in progress / completed / overdue / cancelled)
- Target contractor
- Due date
- Progress bar (X/Y tasks complete)

**Task list (main content):**

- Task title
- Type icon
- Owner (avatar + name)
- Due date
- Status (pending / in progress / completed / blocked / skipped)
- Linked SOP (external URL)
- Action button (complete / skip / reassign)

**Side panel:**

- Notes
- Attachments
- Comments thread
- Audit trail for this workflow
- Blocker flags

### 9.7 Invoice Inbox

**Layout:** Split view — left: table/list | right: preview/review panel

**Table columns:**

- Invoice number
- Contractor
- Amount (netto + brutto)
- Currency
- Due date
- Received at
- Match status (matched / unmatched / discrepancy)
- Approval status
- Payment status
- Flags (icons/chips)

**Invoice statuses flow:**

```
received → unmatched / matched / discrepancy
    → pending approval
        → approved / rejected
            → ready for payment
                → paid
```

**Matching logic panel (right side on review):**

- Detected contractor (auto or manual)
- Active contract found? (yes/no + link)
- Expected amount vs invoice amount
- Deviation % (highlighted if > threshold)
- Billing period
- Notes

**Actions:**

- Attach to contractor
- Attach to contract
- Request clarification
- Approve
- Reject
- Mark ready for payment
- Flag for review

### 9.8 Invoice Detail View

**Sections:**

- Invoice metadata (number, dates, amounts, NIP, bank account)
- Extracted line items / summary (if OCR available)
- Linked contractor (clickable)
- Linked contract (clickable)
- Linked approval chain (timeline with statuses)
- Comments thread
- Audit trail
- Attached original file (PDF viewer embedded)
- Payment info (if paid — date, reference, payment run link)

**Flags (visual alerts):**

- ⚠️ Missing contract
- ⚠️ Expired contract
- ⚠️ Amount above threshold
- ⚠️ Duplicate invoice suspected
- ⚠️ Missing tax details
- ⚠️ Approval overdue
- ⚠️ Bank details mismatch

### 9.9 Approval Queue

**Personal queue:**

- Invoices/tasks awaiting my approval
- SLA timers (time since request, time to deadline)
- Priority sorting (overdue first, then by due date)
- Comments preview
- Inline contractor + contract context

**Bulk actions:**

- Approve selected
- Reject selected
- Delegate to another approver
- Request clarification (batch)

**Approval detail panel:**

- Why this user is the approver (role in approval chain)
- What changed since last version (if re-submitted)
- Expected vs actual amount comparison
- Prior comments from other approvers
- Linked documents
- One-click approve/reject with mandatory comment on reject

### 9.10 Payment Run

**Screen sections:**

1. Ready invoices table
2. Selected totals card (sticky)
3. Export options
4. Payment history (past runs)

**Ready invoices columns:**

- Contractor
- Invoice number
- Due date
- Amount (netto + brutto)
- Currency
- Bank details available? (✅/❌)
- Approval complete? (✅/❌)
- Exceptions (flags)

**Actions:**

- Select all ready
- Select by currency
- Export CSV
- Export bank file (MT940 / SEPA XML / custom)
- Send to accounting
- Mark paid
- Mark failed
- Split payment

**Right summary card (sticky):**

- Total selected amount
- Invoice count
- Breakdown by currency
- Breakdown by due date urgency (overdue / due today / due this week)
- Warnings (missing bank details, incomplete approvals)

### 9.11 Integrations Hub

**Layout:** Tile/card grid

**Available integrations:**

- Slack
- Google Workspace
- Microsoft 365
- Jira
- Email Intake
- E-sign (DocuSign, Autenti)
- KSeF (v1.5+)
- Accounting / ERP
- Open Banking (v2+)
- GitHub / GitLab

**Per integration card:**

- Status (connected / disconnected / error)
- Scopes granted
- Connected by (user)
- Last sync timestamp
- Available actions
- Webhook health
- Logs (recent events)
- Retry queue (failed events)

### 9.12 Reports

**Available reports:**

- Spend by contractor (bar chart + table)
- Spend by team / project / cost center
- Invoices by status (funnel chart)
- Average approval time (trend line)
- Contracts expiring in 30/60/90 days
- Onboarding time to complete (avg days)
- Offboarding overdue
- Missing documents (compliance gaps)
- Contractor concentration risk (% spend per contractor)
- Invoice volume by month

**Report features:**

- Date range selector
- Export to CSV / PDF
- Filter by team / project / contractor
- Drill-down to source records

### 9.13 Settings

**Sections:**

- Organization profile (name, logo, country, default currency, timezone)
- Users & roles management
- Approval flow configuration (default chains, thresholds)
- Workflow templates management
- Custom fields configuration
- Notification preferences (global defaults)
- Email intake configuration
- Integration management
- Audit log viewer
- Data retention policies
- Branding (logo, colors for contractor portal v2)
- Billing & subscription (SaaS plan management)

---

## 10. Core Processes

### 10.1 Onboarding Process

```
TRIGGER: Nowy kontraktor / nowa umowa / status = onboarding

1. Create contractor profile
2. Add billing and company details
3. Upload / sign documents (NDA, B2B contract, IP transfer, DPA)
4. Assign owner, team, projects
5. Launch onboarding workflow from template
6. Complete access and collaboration tasks
   - Slack channels
   - Jira project
   - Google/Microsoft account
   - GitHub/GitLab
7. Verify financial setup (bank details, invoicing instructions)
8. Mark contractor ACTIVE

OUTPUT:
├── Active contractor record
├── Complete document set
├── Configured workflow history
├── Ready for first invoice
└── Audit trail of all steps
```

### 10.2 Invoice-to-Payment Process

```
TRIGGER: Invoice received (email / upload / KSeF)

 1. Intake invoice → create draft record
 2. Parse metadata (invoice number, dates, amounts, NIP)
 3. Match to contractor (by NIP / email / manual)
 4. Match to active contract
 5. Calculate expected amount (based on billing model)
 6. Flag discrepancies (amount, missing contract, expired contract)
 7. Route for approval (based on approval chain config)
 8. Approvers review, comment, decide
 9. Finance moves approved invoices to ready-for-payment
10. Payment run → batch selection → export
11. Mark paid (manual or via bank reconciliation)
12. Notify contractor (optional) → audit log update

EXCEPTION PATHS:
├── Unmatched invoice → manual assignment queue
├── Discrepancy → flag + request clarification
├── Rejected → notify submitter + reason
├── Duplicate detected → quarantine + alert
└── Overdue approval → escalation notification
```

### 10.3 Offboarding Process

```
TRIGGER: Contract expiry / manual termination / contract status = ending

1. System detects approaching end date (30-day reminder)
2. Notify owner to start offboarding
3. Launch offboarding workflow from template
4. Review and close open invoices
5. Revoke system access (Slack, Jira, Google, GitHub, etc.)
6. Recover assets / equipment
7. Collect final deliverables
8. Knowledge transfer
9. Process final invoice
10. Ensure final payment
11. Archive contractor record
12. Mark contractor INACTIVE

SAFETY CHECKS:
├── Cannot archive if open unpaid invoices
├── Cannot archive if unreturned equipment
├── Warning if access not revoked
└── Audit trail of all offboarding steps
```

---

## 11. Wymagania funkcjonalne — moduł po module

### 11.1 Contractor Registry

- CRUD profili kontraktorów
- Typy kontraktora: JDG / sole trader / spółka / freelancer zagraniczny
- Dane firmowe: legal name, NIP, VAT-EU, REGON, adres
- Dane rozliczeniowe: konto bankowe (IBAN), waluta, billing model, stawka
- Owner po stronie firmy (internal user)
- Status współpracy: draft / onboarding / active / offboarding / inactive / archived
- Przypisanie do projektów / cost center / team
- Historia współpracy (timeline)
- Dokumenty i checklisty powiązane
- Compliance health score (calculated)
- Full-text search + advanced filters
- Bulk operations

### 11.2 Contract Repository

- Przechowywanie: umowy B2B, NDA, aneksy, IP transfer, DPA, inne
- Wersjonowanie dokumentów (v1, v2, amendment 1, etc.)
- Metadane: data startu, data końca, okres wypowiedzenia, stawka, waluta, model rozliczeń, payment terms
- Wymagane dokumenty per contract type (configurable)
- Przypomnienia o końcu umowy (30/60/90 dni, configurable)
- Audit trail zmian
- Template library (standardowe szablony umów)
- Statuses: draft / active / expiring / expired / terminated / superseded

### 11.3 Workflow Engine

- Szablony checklist: onboarding / offboarding / document collection / compliance review / custom
- Taski z: owner, deadline, status, dependencies, type
- Task types: document · approval · access grant · access revoke · finance · equipment · meeting · knowledge transfer · manual
- Linkowanie tasków do SOP-ów w Notion (external URLs)
- Akcje ręczne i semi-automatyczne
- Conditional logic (basic: if contractor_type = X then include task Y)
- Due date offsets relative to workflow start
- Role-based assignment (resolve to specific user at runtime)
- Progress tracking
- Pełna historia wykonania
- Overdue detection + notifications
- Bulk operations on tasks

### 11.4 Invoice Intake

- Ręczny upload (drag & drop, multi-file)
- Intake przez dedykowany email inbox (per organization)
- KSeF integration (v1.5+)
- OCR / metadata extraction (optional, v1.5+)
- Auto-assignment do kontraktora (by NIP matching)
- Statusy: received → needs review → matched → approved → rejected → paid
- Obsługa: kwota netto / brutto / VAT / waluta / termin płatności
- Duplicate detection (by invoice number + contractor + amount)
- Attachment storage with virus scanning

### 11.5 Invoice Matching

- Dopasowanie faktury do kontraktora (by NIP / email / manual)
- Dopasowanie do aktywnego kontraktu
- Expected amount calculation based on billing model:
  - **Monthly retainer:** expected = contract rate
  - **Hourly rate:** expected = rate × reported hours (requires timesheet input or manual confirmation)
  - **Milestone / deliverable:** expected = milestone amount (requires deliverable confirmation)
- Deviation flagging (configurable threshold, e.g., >5% or >500 PLN)
- Missing contract flag
- Expired contract flag
- Multi-contract support (contractor with multiple active contracts)

### 11.6 Approval Workflow

- Definiowalne ścieżki akceptacji (configurable per org, per project, per amount threshold)
- 1–3 poziomy approvals
- Approver types: manager / project owner / finance / custom role
- Actions: approve / reject / request clarification / delegate
- Komentarze (mandatory on reject)
- Notyfikacje: Slack / email / in-app
- SLA timers + escalation rules
- Auto-approve rules (optional, e.g., invoice < 500 PLN from known contractor)
- Pełny audit trail
- Re-submission flow (after rejection + correction)

### 11.7 Payment Run

- Lista zatwierdzonych faktur gotowych do płatności
- Batch selection (all / by currency / by due date / manual pick)
- Export: CSV / bank file (SEPA XML, MT940, custom format)
- Accounting export (dedicated format for bookkeeping)
- Oznaczanie: paid / partially paid / failed
- Payment reference tracking (bank reference ID)
- Payment run history
- Idempotency controls (prevent double payment runs)
- Later: open banking / payment initiation API

### 11.8 Compliance & Audit

- Configurable checklista wymaganych dokumentów per contractor type
- Tracking brakujących / wygasających dokumentów
- Przypomnienia (email + in-app)
- Immutable audit trail for:
  - Approvals
  - Contract uploads/changes
  - Payment run exports
  - Role changes
  - Integration changes
  - Contractor status changes
  - Data access events (sensitive operations)
- Compliance fields: NDA, IP assignment, DPA, proof of business, tax details
- Compliance health score per contractor (green/yellow/red)
- Bez udzielania porad prawnych — operational compliance support only
- Data retention policies (configurable)

### 11.9 Reporting & Analytics

- Spend per contractor (trend + totals)
- Spend per team / project / cost center
- Contracts expiring soon (30/60/90 day view)
- Unpaid / overdue invoices
- Contractor concentration risk (% of total spend)
- Average approval time (trend)
- Onboarding completion time
- Offboarding completion time
- Missing documents / compliance gaps
- Invoice volume and trends
- Date range filtering + export (CSV/PDF)

### 11.10 Notifications & Automations

- Notification channels: in-app, email, Slack
- Per-user notification preferences
- Notification types:
  - Approval request
  - Approval decision
  - Invoice received
  - Invoice overdue
  - Contract expiring
  - Workflow task due
  - Workflow task overdue
  - Payment run completed
  - Document missing/expiring
  - Compliance alert
- Digest mode (daily summary vs real-time)
- Automation rules (v1.5+):
  - Auto-assign invoices
  - Auto-start offboarding on contract expiry
  - Auto-remind on overdue tasks
  - Auto-escalate overdue approvals

### 11.11 Admin / Settings

- Organization profile (name, logo, country, currency, timezone, fiscal year)
- User management (invite, deactivate, role assignment)
- Role configuration (RBAC)
- Approval chain configuration
- Workflow template management
- Custom fields (per contractor, per contract, per invoice)
- Notification defaults
- Email intake setup (dedicated address per org)
- Integration management
- Audit log viewer (searchable, filterable, exportable)
- Data retention configuration
- Branding settings (v2: contractor portal)
- Billing & subscription management

---

## 12. Integracje

### 12.1 Email Intake (v1)

**Cel:** Najprostszy kanał wejściowy dla faktur.

| Feature            | Opis                                    |
| ------------------ | --------------------------------------- |
| Dedicated email    | `invoices@{org-slug}.contractorhub.io`  |
| Attachment parsing | Extract PDF/image attachments           |
| Deduplication      | By filename + hash + sender             |
| Spam / security    | Basic filtering, malware scan           |
| Auto-create        | Invoice draft record from email         |
| Sender matching    | Try to match sender email to contractor |

### 12.2 Slack (v1)

**Cel:** Approval workflow + reminders + alerts.

| Feature                | Opis                                       |
| ---------------------- | ------------------------------------------ |
| Approval notifications | DM to approver with approve/reject buttons |
| Inline approve/reject  | Actions directly from Slack                |
| Reminders              | Overdue approvals, expiring contracts      |
| Task reminders         | Onboarding/offboarding task due            |
| Activity alerts        | Configurable channel notifications         |

### 12.3 Google Workspace (v1 — light)

**Cel:** Onboarding/offboarding access management.

| Feature                 | Opis                                               |
| ----------------------- | -------------------------------------------------- |
| Drive folder references | Link to contractor folders                         |
| Access tasks            | Create/check access grant/revoke as workflow tasks |
| Guest access management | Partial, via API (v2: deeper)                      |

### 12.4 Microsoft 365 (v1 — light)

Analogiczne do Google Workspace dla firm na Microsoft stack.

### 12.5 Jira (v1 — light)

**Cel:** Project assignment i access governance.

| Feature               | Opis                           |
| --------------------- | ------------------------------ |
| Project mapping       | Map contractor to Jira project |
| Onboarding task       | Grant Jira access              |
| Offboarding task      | Revoke Jira access             |
| Deliverable reference | Optional link to Jira issues   |

### 12.6 E-sign (v1.5)

**Cel:** Podpisy dokumentów bez chaosu mailowego.

| Feature          | Opis                                        |
| ---------------- | ------------------------------------------- |
| Providers        | DocuSign, Autenti (Polish market), PandaDoc |
| Send for signing | Initiate from contract detail               |
| Status tracking  | Pending / signed / declined                 |
| Auto-attach      | Signed doc → contractor record              |

### 12.7 KSeF (v1.5/v2)

**Cel:** Import i powiązanie faktur w polskim modelu e-faktur.

| Feature             | Opis                          |
| ------------------- | ----------------------------- |
| Pull invoices       | Fetch from KSeF API           |
| Auto-matching       | By NIP to contractor          |
| Metadata extraction | Structured data from KSeF XML |
| Compliance          | KSeF receipt confirmation     |

**Uwaga:** Nie na dzień 1 jeśli zabija roadmapę. Email/upload + manual validation first.

### 12.8 Accounting / ERP light (v2)

**Cel:** Export danych do księgowości.

- Invoice export (structured CSV/XML)
- Contractor export
- Paid status sync
- Accounting package export (wFirma, Faktura.pl, Symfonia, inne)

### 12.9 Open Banking (v2+)

**Cel:** Płatności.

- v1: Export payment file (CSV/bank format) + manual confirmation
- v2+: Payment initiation API + payment status tracking

### 12.10 GitHub / GitLab (v1.5)

**Cel:** Onboarding/offboarding access management.

- Grant/revoke repository access as workflow tasks
- Map contractor to repos/teams

### 12.11 SSO / SCIM (v3)

- SAML / OIDC SSO
- SCIM user provisioning
- Azure AD / Okta / Google Workspace IdP

### 12.12 Webhooks / Public API (v2)

- Outgoing webhooks for key events
- Public REST API for custom integrations
- API key management
- Rate limiting
- Webhook signature validation

### Integration priority matrix

| Integration              | Priority     | Phase   |
| ------------------------ | ------------ | ------- |
| Email intake             | Must have    | v1      |
| Slack                    | Must have    | v1      |
| Google Workspace (light) | Should have  | v1      |
| Microsoft 365 (light)    | Should have  | v1      |
| Jira (light)             | Should have  | v1      |
| E-sign                   | Should have  | v1.5    |
| KSeF                     | Should have  | v1.5/v2 |
| GitHub/GitLab            | Nice to have | v1.5    |
| Accounting/ERP           | Should have  | v2      |
| Open Banking             | Nice to have | v2+     |
| SSO/SCIM                 | Nice to have | v3      |
| Public API + Webhooks    | Should have  | v2      |

---

## 13. Architektura systemu

### 13.1 High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Web App  │  │ Slack Bot    │  │ Email Intake Receiver  │ │
│  │ (React)  │  │              │  │                        │ │
│  └────┬─────┘  └──────┬───────┘  └───────────┬────────────┘ │
└───────┼────────────────┼─────────────────────┼──────────────┘
        │                │                     │
        ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY / LOAD BALANCER               │
│              (rate limiting, auth, tenant resolution)         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     BACKEND API                              │
│                  (Node.js / TypeScript)                       │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Contractors  │ │ Contracts    │ │ Workflows            │ │
│  │ Service      │ │ Service      │ │ Service              │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │ Invoices     │ │ Approvals    │ │ Payments             │ │
│  │ Service      │ │ Service      │ │ Service              │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │ Integrations │ │ Notifications│ │ Audit                │ │
│  │ Service      │ │ Service      │ │ Service              │ │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤ │
│  │ Reporting    │ │ Auth / RBAC  │ │ File                 │ │
│  │ Service      │ │ Service      │ │ Service              │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└────────┬───────────────┬───────────────┬────────────────────┘
         │               │               │
    ┌────▼────┐   ┌──────▼──────┐  ┌─────▼──────┐
    │ PostgreSQL│  │ Object      │  │ Redis      │
    │ (primary │  │ Storage     │  │ (cache +   │
    │  DB)     │  │ (S3/Minio)  │  │  queue)    │
    └─────────┘   └─────────────┘  └────────────┘
```

### 13.2 Frontend

- **Stack:** React + TypeScript + Vite
- **UI framework:** Tailwind CSS + shadcn/ui (or Radix primitives)
- **State management:** TanStack Query (server state) + Zustand (client state)
- **Routing:** React Router v7 or TanStack Router
- **Tables:** TanStack Table
- **Forms:** React Hook Form + Zod validation
- **Features:** App shell, table-heavy B2B UI, forms, filters, command palette (⌘K), role-based rendering
- **Desktop-first**, responsive down to tablet

### 13.3 Backend API

- **Stack:** Node.js + TypeScript
- **Framework:** Fastify or Express (pragmatic choice)
- **API style:** REST (pragmatic) or tRPC (if full-stack TypeScript monorepo)
- **Validation:** Zod
- **ORM:** Prisma or Drizzle
- **Multi-tenant:** All queries scoped to `organization_id` via middleware
- **Domain modules:** Per bounded context (see services above)

### 13.4 Background Jobs / Workers

- **Queue:** BullMQ (Redis-backed) or similar
- **Jobs:**
  - Reminders (contract expiry, task due, invoice overdue)
  - Expiry detection (contract end dates)
  - Email polling / intake processing
  - Webhook retries
  - Invoice parsing (OCR/metadata when available)
  - Integration sync jobs
  - Digest notification compilation
  - Compliance health score recalculation
  - Cleanup / retention enforcement

### 13.5 Storage

| Layer             | Technology                                              | Purpose                                |
| ----------------- | ------------------------------------------------------- | -------------------------------------- |
| Primary DB        | PostgreSQL                                              | Transactional data, all entities       |
| Object Storage    | S3 / MinIO / Cloudflare R2                              | Files (invoices, contracts, documents) |
| Cache + Queue     | Redis                                                   | API cache, job queue, rate limiting    |
| Audit Event Store | PostgreSQL (append-only table) or dedicated event store | Immutable audit trail                  |
| Search Index      | PostgreSQL full-text (v1), Meilisearch/Typesense (v2)   | Full-text search                       |

### 13.6 Event Model

System emituje zdarzenia domenowe, które triggerują side effects (notifications, audit log, integrations):

**Contractor events:**

- `contractor.created`, `contractor.updated`, `contractor.archived`, `contractor.status_changed`

**Contract events:**

- `contract.uploaded`, `contract.updated`, `contract.expiring`, `contract.expired`, `contract.terminated`

**Workflow events:**

- `workflow.started`, `workflow.completed`, `workflow.overdue`
- `task.assigned`, `task.completed`, `task.overdue`, `task.skipped`

**Invoice events:**

- `invoice.received`, `invoice.matched`, `invoice.unmatched`, `invoice.flagged`, `invoice.duplicate_detected`

**Approval events:**

- `approval.requested`, `approval.approved`, `approval.rejected`, `approval.escalated`, `approval.delegated`

**Payment events:**

- `payment_run.created`, `payment_run.exported`, `invoice.marked_paid`, `invoice.payment_failed`

**System events:**

- `integration.connected`, `integration.disconnected`, `integration.error`
- `user.invited`, `user.role_changed`, `user.deactivated`

---

## 14. Model danych

### Core entities

```sql
-- Organization (tenant)
Organization {
  id              UUID PK
  name            VARCHAR(255)
  slug            VARCHAR(100) UNIQUE
  country         VARCHAR(2)       -- ISO 3166-1 alpha-2
  default_currency VARCHAR(3)      -- ISO 4217
  timezone        VARCHAR(50)      -- e.g., 'Europe/Warsaw'
  settings_json   JSONB
  plan            VARCHAR(50)      -- subscription plan
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- User (internal org member)
User {
  id              UUID PK
  org_id          UUID FK → Organization
  name            VARCHAR(255)
  email           VARCHAR(255) UNIQUE per org
  role            ENUM('admin','finance','ops','manager','legal_viewer','it_admin','accountant','readonly')
  status          ENUM('active','invited','deactivated')
  mfa_enabled     BOOLEAN
  last_login_at   TIMESTAMPTZ
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Contractor
Contractor {
  id              UUID PK
  org_id          UUID FK → Organization
  type            ENUM('jdg','sole_trader','company','freelancer_foreign')
  legal_name      VARCHAR(500)
  display_name    VARCHAR(255)
  tax_id          VARCHAR(50)      -- NIP
  vat_id          VARCHAR(50)      -- NIP-EU / VAT-EU
  regon           VARCHAR(20)      -- Polish registry number
  country         VARCHAR(2)
  address_json    JSONB            -- street, city, postal_code, country
  email           VARCHAR(255)
  phone           VARCHAR(50)
  bank_account    VARCHAR(34)      -- IBAN
  bank_name       VARCHAR(255)
  currency        VARCHAR(3)
  billing_model   ENUM('retainer','hourly','milestone')
  default_rate    DECIMAL(12,2)
  owner_user_id   UUID FK → User
  status          ENUM('draft','onboarding','active','offboarding','inactive','archived')
  notes           TEXT
  custom_fields   JSONB
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  archived_at     TIMESTAMPTZ
}

-- Contractor Assignment (to project/team/cost center)
ContractorAssignment {
  id              UUID PK
  contractor_id   UUID FK → Contractor
  entity_type     ENUM('project','team','cost_center')
  entity_id       UUID
  entity_name     VARCHAR(255)
  active_from     DATE
  active_to       DATE
  created_at      TIMESTAMPTZ
}

-- Project / Team / Cost Center (lightweight reference entities)
Project {
  id              UUID PK
  org_id          UUID FK → Organization
  name            VARCHAR(255)
  status          ENUM('active','archived')
  created_at      TIMESTAMPTZ
}

Team {
  id              UUID PK
  org_id          UUID FK → Organization
  name            VARCHAR(255)
  manager_user_id UUID FK → User
  created_at      TIMESTAMPTZ
}

CostCenter {
  id              UUID PK
  org_id          UUID FK → Organization
  code            VARCHAR(50)
  name            VARCHAR(255)
  created_at      TIMESTAMPTZ
}

-- Contract
Contract {
  id                  UUID PK
  org_id              UUID FK → Organization
  contractor_id       UUID FK → Contractor
  type                ENUM('b2b_contract','nda','ip_transfer','dpa','amendment','other')
  title               VARCHAR(500)
  start_date          DATE
  end_date            DATE
  notice_period_days  INTEGER
  currency            VARCHAR(3)
  rate_type           ENUM('monthly','hourly','milestone','fixed')
  rate_value          DECIMAL(12,2)
  billing_cycle       ENUM('monthly','biweekly','per_milestone','on_completion')
  payment_terms_days  INTEGER          -- e.g., 14, 30
  status              ENUM('draft','active','expiring','expired','terminated','superseded')
  metadata_json       JSONB            -- flexible extra fields
  created_at          TIMESTAMPTZ
  updated_at          TIMESTAMPTZ
}

-- Document
Document {
  id              UUID PK
  org_id          UUID FK → Organization
  contractor_id   UUID FK → Contractor (nullable)
  contract_id     UUID FK → Contract (nullable)
  document_type   ENUM('contract_pdf','nda','ip_transfer','dpa','invoice','id_document','tax_certificate','insurance','other')
  title           VARCHAR(500)
  storage_key     VARCHAR(1000)    -- S3 key
  mime_type       VARCHAR(100)
  file_size_bytes BIGINT
  version         INTEGER DEFAULT 1
  status          ENUM('draft','active','signed','expired','superseded','deleted')
  signed_at       TIMESTAMPTZ
  expires_at      TIMESTAMPTZ
  checksum        VARCHAR(128)     -- SHA-256
  uploaded_by     UUID FK → User
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Workflow Template
WorkflowTemplate {
  id              UUID PK
  org_id          UUID FK → Organization
  type            ENUM('onboarding','offboarding','document_collection','compliance_review','custom')
  name            VARCHAR(255)
  description     TEXT
  version         INTEGER DEFAULT 1
  is_active       BOOLEAN DEFAULT true
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Workflow Task Template
WorkflowTaskTemplate {
  id              UUID PK
  template_id     UUID FK → WorkflowTemplate
  sort_order      INTEGER
  title           VARCHAR(500)
  description     TEXT
  task_type       ENUM('document','approval','access_grant','access_revoke','finance','equipment','meeting','knowledge_transfer','manual')
  due_offset_days INTEGER          -- relative to workflow start
  assignee_role   VARCHAR(50)      -- resolved at runtime to user
  required        BOOLEAN DEFAULT true
  depends_on      UUID[]           -- array of task template IDs
  condition_json  JSONB            -- optional: {"if": "contractor.type", "equals": "jdg", "then": "include"}
  external_sop_url VARCHAR(1000)   -- link to Notion SOP
  created_at      TIMESTAMPTZ
}

-- Workflow Run (instance of template)
WorkflowRun {
  id              UUID PK
  org_id          UUID FK → Organization
  contractor_id   UUID FK → Contractor
  template_id     UUID FK → WorkflowTemplate
  status          ENUM('in_progress','completed','overdue','cancelled')
  started_at      TIMESTAMPTZ
  due_at          TIMESTAMPTZ
  completed_at    TIMESTAMPTZ
  started_by      UUID FK → User
  created_at      TIMESTAMPTZ
}

-- Workflow Task Run (instance of task template)
WorkflowTaskRun {
  id              UUID PK
  workflow_run_id UUID FK → WorkflowRun
  task_template_id UUID FK → WorkflowTaskTemplate
  title           VARCHAR(500)
  task_type       ENUM(...)       -- same as template
  assignee_user_id UUID FK → User
  due_at          TIMESTAMPTZ
  status          ENUM('pending','in_progress','completed','blocked','skipped','overdue')
  completed_at    TIMESTAMPTZ
  completed_by    UUID FK → User
  notes           TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Invoice
Invoice {
  id              UUID PK
  org_id          UUID FK → Organization
  contractor_id   UUID FK → Contractor (nullable — may be unmatched)
  contract_id     UUID FK → Contract (nullable)
  invoice_number  VARCHAR(100)
  issue_date      DATE
  due_date        DATE
  currency        VARCHAR(3)
  subtotal        DECIMAL(12,2)    -- netto
  vat_rate        DECIMAL(5,2)     -- e.g., 23.00
  vat_amount      DECIMAL(12,2)
  total           DECIMAL(12,2)    -- brutto
  seller_tax_id   VARCHAR(50)      -- NIP from invoice
  seller_name     VARCHAR(500)
  seller_bank_account VARCHAR(34)
  billing_period_start DATE
  billing_period_end   DATE
  received_at     TIMESTAMPTZ
  source          ENUM('upload','email','ksef','api')
  match_status    ENUM('unmatched','matched','discrepancy')
  approval_status ENUM('pending','in_review','approved','rejected','clarification_requested')
  payment_status  ENUM('unpaid','ready_for_payment','in_payment_run','paid','partially_paid','failed')
  expected_amount DECIMAL(12,2)    -- calculated from contract
  deviation_amount DECIMAL(12,2)   -- difference
  flags_json      JSONB            -- array of flag codes
  storage_key     VARCHAR(1000)    -- S3 key for original file
  line_items_json JSONB            -- optional parsed line items
  notes           TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Approval
Approval {
  id              UUID PK
  org_id          UUID FK → Organization
  resource_type   ENUM('invoice','document','contract','workflow_task')
  resource_id     UUID
  step_order      INTEGER          -- 1, 2, 3 for multi-level
  approver_user_id UUID FK → User
  status          ENUM('pending','approved','rejected','delegated','expired')
  acted_at        TIMESTAMPTZ
  comment         TEXT
  delegated_to    UUID FK → User (nullable)
  sla_deadline    TIMESTAMPTZ
  created_at      TIMESTAMPTZ
}

-- Approval Chain Configuration
ApprovalChainConfig {
  id              UUID PK
  org_id          UUID FK → Organization
  name            VARCHAR(255)
  resource_type   ENUM('invoice','document','contract')
  conditions_json JSONB            -- e.g., {"amount_gte": 5000, "contractor_type": "company"}
  steps_json      JSONB            -- [{order: 1, role: "manager"}, {order: 2, role: "finance"}]
  is_default      BOOLEAN
  created_at      TIMESTAMPTZ
}

-- Payment Run
PaymentRun {
  id              UUID PK
  org_id          UUID FK → Organization
  created_by      UUID FK → User
  name            VARCHAR(255)     -- e.g., "Payment Run March 2026 - PLN"
  currency        VARCHAR(3)
  status          ENUM('draft','exported','partially_paid','completed','cancelled')
  exported_at     TIMESTAMPTZ
  export_format   VARCHAR(50)      -- csv, sepa_xml, mt940, custom
  total_amount    DECIMAL(14,2)
  item_count      INTEGER
  notes           TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Payment Run Item
PaymentRunItem {
  id              UUID PK
  payment_run_id  UUID FK → PaymentRun
  invoice_id      UUID FK → Invoice
  contractor_id   UUID FK → Contractor
  amount          DECIMAL(12,2)
  currency        VARCHAR(3)
  status          ENUM('pending','paid','failed','cancelled')
  payment_reference VARCHAR(100)
  paid_at         TIMESTAMPTZ
  error_message   TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Integration Connection
IntegrationConnection {
  id              UUID PK
  org_id          UUID FK → Organization
  provider        ENUM('slack','google','microsoft','jira','github','gitlab','esign','ksef','accounting','open_banking')
  status          ENUM('connected','disconnected','error','pending')
  scopes          VARCHAR[]
  credentials_ref VARCHAR(255)     -- reference to secrets manager
  config_json     JSONB
  connected_by    UUID FK → User
  last_sync_at    TIMESTAMPTZ
  error_message   TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Notification
Notification {
  id              UUID PK
  org_id          UUID FK → Organization
  user_id         UUID FK → User
  type            VARCHAR(100)     -- e.g., 'approval_requested', 'contract_expiring'
  title           VARCHAR(500)
  body            TEXT
  resource_type   VARCHAR(50)
  resource_id     UUID
  channel         ENUM('in_app','email','slack')
  status          ENUM('pending','sent','read','failed')
  sent_at         TIMESTAMPTZ
  read_at         TIMESTAMPTZ
  created_at      TIMESTAMPTZ
}

-- Audit Log (append-only, immutable)
AuditLog {
  id              UUID PK
  org_id          UUID FK → Organization
  actor_type      ENUM('user','system','integration','api_key')
  actor_id        UUID
  actor_name      VARCHAR(255)     -- denormalized for immutability
  action          VARCHAR(100)     -- e.g., 'invoice.approved', 'contractor.archived'
  resource_type   VARCHAR(50)
  resource_id     UUID
  resource_name   VARCHAR(500)     -- denormalized
  payload_json    JSONB            -- before/after state or relevant details
  ip_address      INET
  user_agent      TEXT
  created_at      TIMESTAMPTZ      -- indexed, partitioned by month
}

-- Comment (polymorphic, attachable to any entity)
Comment {
  id              UUID PK
  org_id          UUID FK → Organization
  resource_type   ENUM('invoice','contractor','contract','workflow_run','workflow_task','approval')
  resource_id     UUID
  author_user_id  UUID FK → User
  body            TEXT
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}

-- Reminder
Reminder {
  id              UUID PK
  org_id          UUID FK → Organization
  resource_type   VARCHAR(50)
  resource_id     UUID
  remind_at       TIMESTAMPTZ
  type            ENUM('contract_expiry','document_expiry','task_due','invoice_overdue','custom')
  recipients      UUID[]           -- user IDs
  status          ENUM('scheduled','sent','cancelled')
  created_at      TIMESTAMPTZ
}

-- User Notification Preferences
UserNotificationPreference {
  id              UUID PK
  user_id         UUID FK → User
  notification_type VARCHAR(100)
  channel_email   BOOLEAN DEFAULT true
  channel_slack   BOOLEAN DEFAULT true
  channel_in_app  BOOLEAN DEFAULT true
  digest_mode     BOOLEAN DEFAULT false   -- if true, aggregate into daily digest
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
}
```

### Indexes (critical)

```sql
-- Multi-tenant scoping (every query)
CREATE INDEX idx_contractor_org ON Contractor(org_id);
CREATE INDEX idx_contract_org ON Contract(org_id);
CREATE INDEX idx_invoice_org ON Invoice(org_id);
CREATE INDEX idx_approval_org ON Approval(org_id);
CREATE INDEX idx_audit_log_org_created ON AuditLog(org_id, created_at DESC);

-- Frequently queried
CREATE INDEX idx_invoice_status ON Invoice(org_id, approval_status, payment_status);
CREATE INDEX idx_invoice_contractor ON Invoice(contractor_id);
CREATE INDEX idx_contract_contractor ON Contract(contractor_id);
CREATE INDEX idx_contract_end_date ON Contract(org_id, end_date);
CREATE INDEX idx_approval_approver ON Approval(approver_user_id, status);
CREATE INDEX idx_workflow_run_contractor ON WorkflowRun(contractor_id);
CREATE INDEX idx_reminder_remind_at ON Reminder(remind_at, status);
CREATE INDEX idx_notification_user ON Notification(user_id, status, created_at DESC);

-- Duplicate invoice detection
CREATE INDEX idx_invoice_dedup ON Invoice(org_id, invoice_number, seller_tax_id);

-- Full-text search
CREATE INDEX idx_contractor_search ON Contractor USING gin(
  to_tsvector('simple', coalesce(legal_name,'') || ' ' || coalesce(display_name,'') || ' ' || coalesce(tax_id,'') || ' ' || coalesce(email,''))
);
```

---

## 15. API Contract

### REST API Design

Base URL: `https://api.contractorhub.io/v1`

All endpoints require `Authorization: Bearer <token>` header.
All endpoints are scoped to the authenticated user's organization.

### Contractors

```
GET    /contractors                        List contractors (paginated, filterable)
POST   /contractors                        Create contractor
GET    /contractors/:id                    Get contractor detail
PATCH  /contractors/:id                    Update contractor
POST   /contractors/:id/archive            Archive contractor
POST   /contractors/:id/start-onboarding   Start onboarding workflow
POST   /contractors/:id/start-offboarding  Start offboarding workflow
GET    /contractors/:id/activity            Get contractor activity timeline
GET    /contractors/:id/compliance          Get compliance status
```

### Contracts

```
GET    /contracts                          List contracts
POST   /contracts                          Create contract
GET    /contracts/:id                      Get contract detail
PATCH  /contracts/:id                      Update contract
POST   /contracts/:id/upload-document      Upload document to contract
POST   /contracts/:id/add-reminder         Add reminder
GET    /contracts/:id/versions             Get version history
POST   /contracts/:id/terminate            Terminate contract
```

### Documents

```
GET    /documents                          List documents (filterable by contractor/contract)
POST   /documents                          Upload document
GET    /documents/:id                      Get document metadata
GET    /documents/:id/download             Get signed download URL
DELETE /documents/:id                      Soft-delete document
```

### Workflows

```
GET    /workflow-templates                 List templates
POST   /workflow-templates                 Create template
GET    /workflow-templates/:id             Get template detail
PATCH  /workflow-templates/:id             Update template
POST   /workflow-runs                      Start workflow run
GET    /workflow-runs                      List workflow runs
GET    /workflow-runs/:id                  Get workflow run detail
POST   /workflow-tasks/:id/complete        Complete task
POST   /workflow-tasks/:id/skip            Skip task
POST   /workflow-tasks/:id/reassign        Reassign task
POST   /workflow-tasks/:id/comment         Add comment to task
```

### Invoices

```
GET    /invoices                           List invoices (paginated, filterable)
POST   /invoices/upload                    Upload invoice (file)
POST   /invoices/email-intake/reprocess    Reprocess email intake
GET    /invoices/:id                       Get invoice detail
PATCH  /invoices/:id                       Update invoice metadata
POST   /invoices/:id/match                 Match invoice to contractor/contract
POST   /invoices/:id/submit-for-approval   Submit for approval
POST   /invoices/:id/approve               Approve invoice
POST   /invoices/:id/reject                Reject invoice
POST   /invoices/:id/request-clarification Request clarification
POST   /invoices/:id/mark-ready            Mark ready for payment
POST   /invoices/:id/mark-paid             Mark as paid
GET    /invoices/:id/download              Get signed download URL
```

### Approvals

```
GET    /approvals/my-queue                 My pending approvals
GET    /approvals                          All approvals (admin/finance)
POST   /approvals/:id/approve              Approve
POST   /approvals/:id/reject               Reject
POST   /approvals/:id/delegate             Delegate to another user
POST   /approvals/:id/comment              Add comment
```

### Payments

```
GET    /payment-runs                       List payment runs
POST   /payment-runs                       Create payment run (select invoices)
GET    /payment-runs/:id                   Get payment run detail
POST   /payment-runs/:id/export            Export bank file
POST   /payment-runs/:id/mark-paid         Mark entire run as paid
PATCH  /payment-run-items/:id              Update individual item status
```

### Integrations

```
GET    /integrations                       List all integrations and status
POST   /integrations/:provider/connect     Initiate connection (OAuth flow start)
POST   /integrations/:provider/callback    OAuth callback
DELETE /integrations/:provider/disconnect   Disconnect
GET    /integrations/:provider/logs        Get integration event logs
POST   /integrations/:provider/test        Test connection
```

### Reports

```
GET    /reports/spend-by-contractor        Spend breakdown
GET    /reports/spend-by-team              Spend by team/project
GET    /reports/contracts-expiring         Expiring contracts
GET    /reports/invoices-overdue           Overdue invoices
GET    /reports/workflow-performance       Workflow completion stats
GET    /reports/compliance-gaps            Missing documents
GET    /reports/concentration-risk         Contractor concentration
```

### Notifications

```
GET    /notifications                      List my notifications
POST   /notifications/:id/read            Mark as read
POST   /notifications/read-all            Mark all as read
GET    /notification-preferences           Get my preferences
PATCH  /notification-preferences           Update preferences
```

### Audit Logs

```
GET    /audit-logs                         List audit logs (admin only, paginated, filterable)
GET    /audit-logs/export                  Export audit logs (CSV)
```

### Common patterns

- **Pagination:** `?page=1&per_page=25` (cursor-based for audit logs)
- **Filtering:** `?status=active&owner_id=xxx&billing_model=retainer`
- **Sorting:** `?sort=created_at&order=desc`
- **Search:** `?q=search+term`
- **Date ranges:** `?date_from=2026-01-01&date_to=2026-03-31`

---

## 16. Security & Compliance

### 16.1 Multi-tenancy

- Każde zapytanie DB scoped do `organization_id` via middleware (no exceptions)
- Brak cross-tenant data leakage — tested via automated security tests
- Tenant-aware caching (cache keys include org_id)
- Tenant-aware background jobs (org_id in job payload)
- Soft-delete with tenant isolation
- Regular cross-tenant leak audits

### 16.2 RBAC

- Role-based access control (see roles matrix in section 7)
- Row-level scoping for team managers (see only own team's contractors)
- Resource-level permissions (action-level authorization checks)
- API-level and UI-level enforcement (never rely on UI alone)
- Role changes logged in audit trail

### 16.3 File Security

- Object storage: private buckets only, no public access
- Signed URLs: short-lived (5–15 min expiry)
- Malware scanning on all uploads (ClamAV or cloud-native)
- MIME type validation (file content, not just extension)
- Checksum validation (SHA-256)
- File size limits: 25 MB per file (configurable)
- Optional virus quarantine

### 16.4 Authentication

- Email/password with strong password policy
- MFA support (TOTP, ready for WebAuthn)
- SSO readiness (SAML, OIDC) — v3
- Session management:
  - Session rotation on privilege change
  - Device/session visibility
  - Max session duration (configurable)
  - Forced logout on role change/deactivation
- Account lockout after N failed attempts

### 16.5 Audit Trail

- Immutable append-only audit log
- Critical actions logged:
  - Approvals (all decisions)
  - Contract uploads/changes
  - Payment run creation/export
  - Role changes
  - Integration connect/disconnect
  - Contractor status changes
  - Data access to sensitive fields
  - Settings changes
- Retention: minimum 7 years for financial records (configurable)
- Partitioned by month for performance

### 16.6 Integration Security

- Encrypted secrets storage (vault or KMS)
- OAuth token rotation
- Webhook signature validation (HMAC-SHA256)
- Least privilege scopes for all integrations
- Integration credential rotation reminders

### 16.7 Application Security

- CSRF protection
- Rate limiting (per-user, per-org, per-endpoint)
- Idempotency keys for payments/uploads (prevent double submission)
- Action-level authorization (not just route-level)
- Anti-duplicate upload detection (checksum-based)
- Secure logging (no PII in application logs, only in encrypted audit trail)
- Input validation and sanitization
- SQL injection prevention (parameterized queries via ORM)
- XSS prevention (React default escaping + CSP headers)
- CORS configuration (strict origin matching)

### 16.8 Privacy / GDPR

- Data retention policies (configurable per data type)
- Legal basis mapping per data category
- Right to export (data portability via API/CSV)
- Right to delete (soft-delete + scheduled hard-delete after retention period)
- Data minimization (only collect necessary data)
- Masked sensitive data in UI:
  - Bank account: `PL** **** **** **** **** **34 56`
  - Tax ID: partial masking for non-finance roles
- Cookie consent and privacy policy
- Data processing records
- Breach notification process documented

### 16.9 Infrastructure Security

- Encryption at rest (database, object storage)
- Encryption in transit (TLS 1.3)
- Network isolation (VPC, security groups)
- Regular dependency vulnerability scanning
- Container image scanning
- Secrets never in code (env vars / secrets manager)
- Regular penetration testing (annual minimum)
- SOC 2 readiness considerations from design phase

---

## 17. MVP Scope

### Must-have (v1.0)

| Module           | Scope                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| Organization     | Create, settings, branding                                                       |
| Users            | Invite, roles (admin, finance, ops, manager, readonly), deactivate               |
| Contractors      | Full CRUD, search, filters, bulk actions                                         |
| Contracts        | Upload, metadata, versions, reminders, statuses                                  |
| Documents        | Upload, link to contractor/contract, download                                    |
| Workflows        | Template builder, onboarding/offboarding templates, run execution, task tracking |
| Invoices         | Upload, email intake, manual matching, status tracking                           |
| Invoice matching | Contractor + contract matching, expected amount vs actual, deviation flags       |
| Approvals        | Configurable 1-3 level chains, approve/reject/clarify, comments                  |
| Payment run      | Select approved invoices, export CSV, mark paid                                  |
| Notifications    | In-app + email for approvals, tasks, reminders                                   |
| Slack            | Approval notifications, approve/reject from Slack                                |
| Audit log        | Immutable trail for all critical actions                                         |
| Dashboard        | KPIs, alerts, approval queue widget, activity feed                               |
| Reports          | Basic: spend by contractor, expiring contracts, overdue invoices                 |

### Nice-to-have

- Contractor portal (self-service)
- E-sign integration
- KSeF native integration
- Open banking / payment initiation
- OCR / intelligent invoice parsing
- Deep Google/Microsoft/Jira integration (beyond task references)
- Complex conditional workflow logic
- Custom field builder
- Advanced reporting / export
- API + webhooks (public)
- SSO/SCIM

---

## 18. Post-MVP Roadmap

### Phase 2 (v1.5 — after v1)

- Stronger rules engine for approval chains
- Contractor portal (read-only: docs, invoices, status)
- External accountant portal
- E-sign integration (Autenti / DocuSign)
- Better invoice parsing (OCR/AI metadata extraction)
- Duplicate invoice detection (intelligent)
- Compliance dashboard
- Advanced reminders + escalation
- Custom fields builder
- GitHub/GitLab integration

### Phase 3 (v2.0 — after v1)

- KSeF integration
- Accounting integrations (wFirma, Symfonia, etc.)
- Open banking payment initiation
- Public API + outgoing webhooks
- Spend anomaly detection
- Access governance integrations (deeper Google/Microsoft/Jira sync)
- SSO / SCIM

### Phase 4 (v3.0)

- Contractor capacity / utilization tracking
- Cross-entity support (multi-legal-entity)
- Multi-country compliance packs (Czech, Romania, etc.)
- Partner ecosystem: accountants, legal, ops consultants
- Marketplace / directory features
- AI-powered: contract analysis, invoice categorization, spend forecasting

---

## 19. Non-Goals

Nie budujemy teraz (i prawdopodobnie nigdy):

- Payroll dla etatów
- EOR/AOR
- Performance review
- Recruiting / ATS
- Employee engagement
- Full procurement suite
- Vendor marketplace
- Broad CRM
- Full accounting suite
- Full bank / treasury stack
- Notion replacement
- Jira replacement
- Project management tool

---

## 20. Ryzyka

### Produktowe

| Ryzyko                                                      | Mitygacja                                                |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| Za szeroki scope — próba bycia Notion+Deel+SAP+księgowością | Brutalne pilnowanie granicy: contractor ops only         |
| Feature creep w kierunku HR/payroll                         | Clear non-goals, product council review                  |
| Zbyt duża złożoność workflow engine                         | Start with linear checklists, add complexity iteratively |

### Techniczne

| Ryzyko                                  | Mitygacja                                                 |
| --------------------------------------- | --------------------------------------------------------- |
| Integracje zjadają roadmapę             | v1 = Slack + email intake only; reszta light/placeholder  |
| Zbyt wcześnie KSeF / open banking / ERP | Phase v1.5/v2, nie v1                                     |
| Multi-tenancy bugs (data leak)          | Tenant scoping middleware + automated cross-tenant tests  |
| File storage security                   | Signed URLs, malware scanning, private buckets from day 1 |

### GTM (Go-to-Market)

| Ryzyko                                | Mitygacja                                          |
| ------------------------------------- | -------------------------------------------------- |
| Firmy zbyt małe, by płacić            | Target 20+ osób, 10+ kontraktorów                  |
| Buyer confusion: HR vs finance vs ops | Clear positioning: "contractor ops", not "HR tool" |
| Długi sales cycle (B2B)               | Founder-led sales + design partners + PLG elements |
| KSeF timing — window of opportunity   | Fast MVP, leverage KSeF deadline as urgency driver |

### Operacyjne

| Ryzyko                                                  | Mitygacja                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Użytkownicy oczekują porady prawnej                     | Explicit disclaimers, operational compliance only                            |
| Duża perceived odpowiedzialność (płatności, compliance) | Clear terms of service, "coordination layer" not "source of truth for legal" |
| Churn: użytkownicy raz skonfigurują i przestaną wracać  | Daily value via invoice approval flow (daily painkiller)                     |

---

## 21. Pozycjonowanie produktu

### Messaging

**Nie:** "Platforma do freelancer management"

**Tak:**

- "Kontraktorzy B2B bez Excela"
- "Umowy, faktury, akceptacje i płatności kontraktorów w jednym miejscu"
- "Contractor Ops dla firm, które pracują z B2B"
- "From contract to payment run"
- "Jeden system na cały lifecycle kontraktora B2B"

### Competitive positioning

| Competitor               | Their focus                               | Our differentiation                                      |
| ------------------------ | ----------------------------------------- | -------------------------------------------------------- |
| Deel / Remote            | Cross-border EOR, $29-49/contractor       | We're local-first, cheaper, contractor lifecycle focused |
| Faktura.pl / SaldeoSMART | Invoice/KSeF — document as primary entity | We have contractor as primary entity with full lifecycle |
| Notion / Excel           | DIY manual tracking                       | We're structured execution layer with audit trail        |
| SAP Fieldglass           | Enterprise procurement                    | We're SMB/mid-market, fast to implement, simple          |

---

## 22. Product Wedge & Differentiator

**Najmocniejszy wedge:** Invoice approval + contract awareness + offboarding awareness

System wie:

1. **Kim jest kontraktor** — profil, typ, dokumenty
2. **Jaka umowa obowiązuje** — warunki, stawka, termin
3. **Jaka kwota jest oczekiwana** — calculated z kontraktu
4. **Kto ma zatwierdzić** — zdefiniowana ścieżka approval
5. **Kiedy ma iść płatność** — due date + payment run schedule
6. **Czy umowa się kończy** — proactive alerts
7. **Czy trzeba zacząć offboarding** — automated triggers

**To daje realny, codzienny painkiller.**

---

## 23. ⚠️ Gap Analysis — Brakujące elementy

Poniżej lista elementów, które **brakowały lub były niedostatecznie opisane** w oryginalnym PRD. Każdy element jest oznaczony priorytetem.

### 23.1 🔴 Krytyczne braki (blokują produkcyjne wdrożenie)

#### A. Pricing & Billing Model (brak w oryginale)

PRD nie definiuje modelu cenowego SaaS — co jest kluczowe dla MVP, bo determinuje:

- Jak wygląda signup flow
- Czy jest trial / freemium
- Jakie limity ma darmowy tier
- Jak naliczane opłaty (platform fee / per-contractor / per-invoice)

**Rekomendacja:**

- **Starter:** 350 PLN/mo — do 10 kontraktorów, 2 userów, basic features
- **Growth:** 650 PLN/mo — do 30 kontraktorów, 10 userów, full features
- **Scale:** 1200 PLN/mo — do 50+ kontraktorów, unlimited users, priority support
- **Per-contractor add-on:** +25 PLN/mo powyżej limitu planu
- **14-day free trial**, no credit card required
- Billing cycle: monthly or annual (20% discount)

#### B. Data Migration / Import (brak w oryginale)

Firmy mają dane w Excelu. Bez importu adopcja będzie bolesna.

**Rekomendacja dla v1:**

- CSV/XLSX import dla kontraktorów (bulk)
- CSV/XLSX import dla kontraktów (basic metadata)
- Import wizard z mapowaniem kolumn
- Walidacja i preview przed commitem
- Error report po imporcie

#### C. Onboarding dla samego produktu (brak w oryginale)

Jak nowa organizacja zaczyna pracę z ContractorOps?

**Rekomendacja:**

- Signup flow: create org → invite first users → import contractors or add first one
- Guided setup wizard (5 steps):
  1. Organization details
  2. Invite team members + assign roles
  3. Import or add first contractor
  4. Configure approval chain
  5. Connect Slack
- Empty states z call-to-action na każdym widoku
- Sample data option ("Try with demo data")
- In-app onboarding checklist (progress bar)

#### D. Error States & Edge Cases (niedostatecznie opisane)

**Rekomendacja — kluczowe edge cases do obsłużenia:**

- Faktura od nieznanego kontraktora (NIP nie pasuje do żadnego w systemie)
- Faktura bez numeru NIP
- Kontraktor z wieloma aktywnymi kontraktami — do którego dopasować?
- Approval chain — co jeśli approver jest niedostępny (urlop, deactivated)?
- Payment run — co jeśli bank details są niekompletne?
- Workflow task — co jeśli assigned role nie ma żadnego aktywnego usera?
- Concurrent edits na tym samym rekordzie
- Email intake — co z fakturami w body emaila (nie jako attachment)?
- Contractor z walutą inną niż faktura
- VAT rates: 23%, 8%, 5%, 0%, ZW, NP, odwrotne obciążenie

### 23.2 🟡 Istotne braki (potrzebne przed launch)

#### E. Localization / i18n

Pierwszy rynek to Polska, ale system powinien być gotowy na ekspansję.

**Rekomendacja:**

- v1: Polish + English UI
- i18n framework od dnia 1 (react-intl lub next-intl)
- Dates: locale-aware formatting
- Currency: locale-aware formatting
- Numbers: locale-aware (1 234,56 vs 1,234.56)
- Translations: UI strings externalized from day 1
- Email templates: per-language

#### F. Mobile / Responsive Strategy

PRD mówi "desktop-first", ale nie adresuje mobile.

**Rekomendacja:**

- v1: Desktop-first, responsive down to tablet (1024px)
- Approval flow: must work on mobile browser (manager approving on phone)
- v2: Consider PWA for notification support
- No native mobile app planned

#### G. Search Architecture

Command palette (⌘K) jest wymieniony, ale nie opisany.

**Rekomendacja:**

- Global search bar w topbar
- Command palette (⌘K / Ctrl+K):
  - Search contractors, contracts, invoices
  - Quick actions: "Add contractor", "Upload invoice"
  - Navigation: "Go to Payments", "Go to Reports"
- Search scope: legal_name, display_name, tax_id, email, invoice_number, contract_title
- v1: PostgreSQL full-text search
- v2: Dedicated search engine (Meilisearch/Typesense) for speed

#### H. Backup & Disaster Recovery

**Rekomendacja:**

- Database: Daily automated backups, 30-day retention
- Point-in-time recovery capability
- Object storage: Cross-region replication or versioned bucket
- RTO (Recovery Time Objective): < 4 hours
- RPO (Recovery Point Objective): < 1 hour
- Documented disaster recovery runbook
- Regular DR drills (quarterly)

#### I. Performance Requirements

**Rekomendacja:**

- Page load: < 2 seconds (p95)
- API response: < 500ms (p95) for standard queries
- Dashboard load: < 3 seconds (p95)
- Search: < 300ms (p95)
- File upload: up to 25MB, < 10 seconds
- Concurrent users per org: support up to 50 simultaneous
- Invoice intake email processing: < 60 seconds

#### J. Monitoring & Observability

**Rekomendacja:**

- Application monitoring: Sentry (errors), Datadog/Grafana (metrics)
- Structured logging (JSON) with correlation IDs
- Health check endpoints (`/health`, `/ready`)
- Key metrics dashboards:
  - API latency p50/p95/p99
  - Error rates
  - Background job queue depth
  - Email intake processing lag
  - Active tenant count
  - Invoice processing funnel
- Alerting: PagerDuty/Opsgenie for critical alerts
- Uptime monitoring: external synthetic checks

#### K. Testing Strategy

**Rekomendacja:**

- Unit tests: business logic, matching engine, approval routing
- Integration tests: API endpoints with DB
- Cross-tenant isolation tests (automated)
- E2E tests: critical flows (invoice → approval → payment)
- Load tests: simulate peak invoice periods (month-end)
- Security tests: OWASP top 10, cross-tenant access attempts
- CI pipeline: lint → type-check → unit → integration → e2e

### 23.3 🟢 Przydatne braki (v1.5 / v2)

#### L. Webhooks Outgoing (wspomniane, ale nie opisane)

**Rekomendacja:**

- Configurable outgoing webhooks for all domain events
- Webhook registration UI w Settings
- Retry logic: exponential backoff, max 5 retries
- Delivery logs with status
- Signature validation (HMAC-SHA256)
- Webhook testing tool (send test payload)

#### M. API Versioning

**Rekomendacja:**

- URL-based versioning: `/v1/contractors`
- Deprecation policy: 12-month notice before breaking changes
- Version header optional: `X-API-Version: 2026-03-18`
- Changelog maintained publicly

#### N. Bulk Import for Invoices

Poza bulk import kontraktorów, firmy mogą chcieć importować historyczne faktury.

**Rekomendacja (v1.5):**

- CSV import z mapowaniem pól
- Batch upload multiple PDFs
- Historical data import (with special "imported" source flag)

#### O. Accessibility (WCAG)

**Rekomendacja:**

- WCAG 2.1 AA compliance target
- Keyboard navigation for all actions
- Screen reader compatibility
- Color contrast ratios
- Focus management in modals/drawers
- ARIA labels on interactive elements

#### P. Analytics / Telemetry (Product Analytics)

**Rekomendacja:**

- Product analytics: PostHog or Mixpanel
- Track: feature adoption, funnel completion, time-to-value
- Key events: first contractor added, first invoice processed, first payment run
- Cohort analysis: weekly active orgs, feature retention
- Privacy-compliant: anonymized where possible

#### Q. Rate Limiting Details

**Rekomendacja:**

- API: 100 req/min per user, 1000 req/min per org
- File upload: 10 files/min per user
- Email intake: 100 emails/hour per org
- Login attempts: 5 per 15 minutes per account
- Password reset: 3 per hour per email
- Export: 5 per hour per user

#### R. Timezone & Date Handling

**Rekomendacja:**

- Organization timezone setting (default: Europe/Warsaw)
- All timestamps stored as UTC in DB
- Displayed in org timezone in UI
- Due dates: date-only (no time component) to avoid timezone confusion
- Invoice dates: date-only
- Reminder scheduling: uses org timezone

---

## 24. Open Questions

1. **Contractor Portal timing:** Is v2 early enough? Some customers may expect contractors to self-submit invoices from day 1.
2. **KSeF integration priority:** Given April 2026 deadline — should this be elevated to v1.0 must-have?
3. **OCR/AI invoice parsing:** Build vs buy? Mindee, Rossum, or custom model?
4. **E-sign provider choice:** Autenti (Polish market leader) vs DocuSign (global)? Support both?
5. **Multi-currency payment runs:** How to handle? Separate runs per currency, or mixed?
6. **Hourly billing model:** Where does timesheet data come from? Manual entry, Jira integration, external tool?
7. **Contract templates:** Should we provide default Polish B2B contract templates? Legal risk?
8. **Biura rachunkowe as channel:** Should we build a partner/accountant portal in v1.5 and use accountants as distribution channel?
9. **Data residency:** EU-only hosting required? Which cloud provider/region?
10. **Free tier vs trial only:** Is there value in a permanent free tier (e.g., up to 3 contractors) for virality?
11. **Naming:** Final product name? "ContractorOps" is descriptive but generic. Consider Polish-friendly name?
12. **White-labeling:** Should accountant partners be able to offer this under their brand?

---

_Koniec dokumentu. Wersja 1.1 — zrewidowana z pełną gap analysis._
