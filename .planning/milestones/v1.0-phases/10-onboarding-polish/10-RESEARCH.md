# Phase 10: Onboarding & Polish - Research

**Researched:** 2026-03-22
**Domain:** CSV/XLSX import, onboarding wizard, empty states, global search & command palette
**Confidence:** HIGH

## Summary

Phase 10 delivers four distinct feature areas that share a common goal: making the application welcoming and efficient for both new and power users. The CSV/XLSX import wizard lets existing spreadsheet users bring contractor and contract data into the system. The onboarding wizard provides guided setup for new organizations. Empty states replace blank screens with contextual CTAs across all list views. Global search and the Cmd+K command palette give power users fast navigation and entity discovery.

The project already has strong foundations for all four areas: `xlsx` 0.18.5 is installed and used for export (reverse the pattern for import), `cmdk` 1.1.1 is installed with full component library in `command.tsx`, PostgreSQL tsvector search vectors exist for contractors and contracts, the `wizard-dialog.tsx` pattern provides a proven multi-step form architecture, and `DashboardEmptyState` in the dashboard page establishes the empty state design pattern.

**Primary recommendation:** Build the import wizard as a server-side async processing pipeline (file upload -> parse -> validate -> preview -> commit), use the existing cmdk CommandDialog for the palette, add an invoice search vector migration to complete global search coverage, and create a reusable `EmptyState` component that all list pages can adopt.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Auto-match column mapping by header names with manual override dropdowns. System guesses mappings (e.g., "Company Name" -> legalName), user corrects mismatches in a dropdown grid
- **D-02:** Import valid rows, skip invalid -- show a table of rejected rows with error details per field. User can fix and re-import just the failures
- **D-03:** Duplicate detection by NIP/tax ID -- highlight conflicts, let user choose per-row: skip, update existing, or create new
- **D-04:** Support large imports (1000+ rows) -- upload file to server, async processing with status polling. Parse with xlsx library (already in deps)
- **D-05:** Persistent dashboard checklist widget (like Stripe/Linear) that also re-enterable from Settings ("Setup Guide"). Not a blocking modal
- **D-06:** Full 5-step wizard: Org details -> Invite team -> Import/add contractor -> Configure approval chain -> Connect Slack. Some steps marked optional (approval chain, Slack)
- **D-07:** Soft dismiss -- no explicit "skip". "I'll do this later" collapses wizard into a dashboard checklist widget
- **D-08:** Progress persisted in org settingsJson as `onboardingCompletedSteps: string[]` -- survives across sessions, visible to all admins
- **D-09:** Every list/view gets a dedicated empty state -- core entity lists (Contractors, Contracts, Invoices, Workflows, Payments) + Dashboard widgets, Reports, Approval queue, Notification center, Audit log
- **D-10:** Guided format: icon + heading + explanatory paragraph + primary CTA button + secondary action (e.g., "Add contractor" + "Import from CSV")
- **D-11:** Smart sequencing: empty states suggest the logical next step based on what data exists
- **D-12:** Friendly/encouraging tone
- **D-13:** Search covers contractors, contracts, invoices + all pages/sections as navigation targets
- **D-14:** Quick actions: navigation to any page + create actions ("New contractor", "New contract", "Upload invoice", "Start workflow") + contextual actions based on current page
- **D-15:** Recent items + user-pinned favorites shown when palette opens before typing. Last 5-10 viewed entities, user can pin frequently accessed items
- **D-16:** Flat result list ranked by relevance with small type badge (Contractor/Contract/Invoice/Page), not grouped sections

### Claude's Discretion
- Loading/error states for import processing
- Exact onboarding checklist widget placement and styling
- Search result ranking algorithm and debounce timing
- How many recent items to show (5-10 range)
- Empty state icon choices per view
- Keyboard shortcuts beyond Cmd+K

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMP-01 | User can import contractors from CSV/XLSX with column mapping wizard | xlsx 0.18.5 parsing (reverse of export pattern), wizard-dialog.tsx multi-step form pattern, contractorCreateSchema for validation |
| IMP-02 | System validates imported data and shows preview before committing | Zod schema validation per-row, TanStack Table for preview rendering, async server processing with status polling |
| IMP-03 | User can import contracts from CSV/XLSX with basic metadata | Same xlsx parsing, contractCreateSchema for validation, contractor lookup by taxId for foreign key resolution |
| ONBD-01 | New org sees guided setup wizard (5 steps) | settingsJson for onboardingCompletedSteps persistence, wizard-dialog.tsx step pattern, dashboard page integration point |
| ONBD-02 | Empty states show contextual call-to-action on every view | DashboardEmptyState as existing pattern, reusable EmptyState component, smart sequencing via data existence checks |
| SRCH-01 | User can search across contractors, contracts, invoices from global search bar | PostgreSQL tsvector already on Contractor and Contract, need invoice search vector migration, unified search tRPC endpoint |
| SRCH-02 | User can use command palette (Cmd+K) for search + quick actions + navigation | cmdk 1.1.1 with CommandDialog already installed, navigation.ts provides page list, top-bar.tsx has Search button ready for wiring |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| xlsx | 0.18.5 | CSV/XLSX file parsing and generation | Already in deps for report export; handles both CSV and XLSX; BOM support for Polish characters |
| cmdk | 1.1.1 | Command palette UI primitives | Already installed with full component library in command.tsx; industry standard for Cmd+K palettes |
| react-hook-form | (existing) | Multi-step wizard forms | Already used throughout project for all wizard dialogs |
| zod | (existing) | Import row validation | Already used for all schema validation; contractorCreateSchema and contractCreateSchema provide validation rules |
| @tanstack/react-query | (existing) | Async import status polling | Already used throughout; refetchInterval for polling pattern |
| @tanstack/react-table | (existing) | Import preview and rejected rows tables | Already used for all data tables in the project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dropzone | (existing) | File upload for CSV/XLSX import | Already in drop-zone.tsx; reuse for import file selection |
| lucide-react | (existing) | Icons for empty states and palette items | Already used throughout; provides all needed icons |
| next-intl | (existing) | i18n for all new strings | All UI strings must go through i18n (en.json/pl.json) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xlsx for parsing | papaparse | papaparse is CSV-only; xlsx handles both CSV and XLSX which is required |
| PostgreSQL tsvector | Meilisearch/Typesense | External search service is overkill for entity count; tsvector already proven in project |
| cmdk | kbar | cmdk already installed and component library built; kbar would require starting over |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
├── routers/
│   ├── import.ts           # Import wizard tRPC router (upload, parse, validate, commit)
│   └── search.ts           # Global search tRPC router (unified cross-entity search)
├── services/
│   └── import-processor.ts # Server-side CSV/XLSX parsing, validation, duplicate detection
apps/web/src/
├── components/
│   ├── import/
│   │   ├── import-wizard-dialog.tsx   # Multi-step import wizard
│   │   ├── step-upload.tsx            # File upload step
│   │   ├── step-mapping.tsx           # Column mapping step
│   │   ├── step-preview.tsx           # Validation preview + duplicate resolution
│   │   └── step-results.tsx           # Import results summary
│   ├── onboarding/
│   │   ├── onboarding-checklist.tsx   # Dashboard checklist widget
│   │   ├── onboarding-wizard.tsx      # Full-page/dialog 5-step wizard
│   │   └── step-*.tsx                 # Individual onboarding steps
│   ├── search/
│   │   ├── command-palette.tsx        # Cmd+K palette using CommandDialog
│   │   ├── search-provider.tsx        # Global keyboard listener + state
│   │   └── search-bar.tsx             # Header search input (optional inline)
│   └── shared/
│       └── empty-state.tsx            # Reusable empty state component
```

### Pattern 1: Server-Side Import Processing
**What:** Upload file to server, parse with xlsx, validate each row against Zod schemas, return structured results
**When to use:** All CSV/XLSX imports (contractors and contracts)
**Example:**
```typescript
// packages/api/src/services/import-processor.ts
import { z } from "zod";

type ImportRow = {
  rowNumber: number;
  data: Record<string, unknown>;
  status: "valid" | "invalid" | "duplicate";
  errors: Array<{ field: string; message: string }>;
  duplicateOf?: string; // existing entity ID
};

type ImportResult = {
  validRows: ImportRow[];
  invalidRows: ImportRow[];
  duplicateRows: ImportRow[];
  columnMapping: Record<string, string>;
};

// Parse file, auto-map columns, validate each row
export async function processImportFile(
  buffer: Buffer,
  entityType: "contractor" | "contract",
  organizationId: string,
): Promise<ImportResult> {
  const { default: XLSX } = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
  // ... auto-map, validate, detect duplicates
}
```

### Pattern 2: Onboarding State in settingsJson
**What:** Store completed onboarding steps in Organization.settingsJson
**When to use:** Tracking onboarding progress across sessions
**Example:**
```typescript
// Read onboarding state
const org = await prisma.organization.findUnique({ where: { id: orgId } });
const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
const completedSteps = (settings.onboardingCompletedSteps as string[]) ?? [];

// Update onboarding state (merge pattern from existing settingsJson usage)
await prisma.organization.update({
  where: { id: orgId },
  data: {
    settingsJson: {
      ...settings,
      onboardingCompletedSteps: [...completedSteps, "invite-team"],
    },
  },
});
```

### Pattern 3: Unified Search Endpoint
**What:** Single tRPC query that searches across contractors, contracts, and invoices using existing tsvector columns
**When to use:** Global search bar and command palette entity search
**Example:**
```typescript
// packages/api/src/routers/search.ts
search: protectedProcedure
  .input(z.object({ query: z.string().min(2).max(100) }))
  .query(async ({ ctx, input }) => {
    const terms = input.query.trim().split(/\s+/)
      .map(t => t.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ""))
      .filter(Boolean).map(t => `${t}:*`).join(" & ");

    const [contractors, contracts, invoices] = await Promise.all([
      prisma.$queryRaw`SELECT id, "legalName" as name, 'contractor' as type
        FROM "Contractor" WHERE "organizationId" = ${ctx.organizationId}
        AND "deletedAt" IS NULL
        AND "search_vector" @@ to_tsquery('simple', ${terms}) LIMIT 5`,
      prisma.$queryRaw`SELECT id, title as name, 'contract' as type
        FROM "Contract" WHERE "organizationId" = ${ctx.organizationId}
        AND "deletedAt" IS NULL
        AND "searchVector" @@ to_tsquery('simple', ${terms}) LIMIT 5`,
      // Invoice search (needs migration first)
      prisma.$queryRaw`SELECT id, "invoiceNumber" as name, 'invoice' as type
        FROM "Invoice" WHERE "organizationId" = ${ctx.organizationId}
        AND "deletedAt" IS NULL
        AND "search_vector" @@ to_tsquery('simple', ${terms}) LIMIT 5`,
    ]);

    return [...contractors, ...contracts, ...invoices];
  }),
```

### Pattern 4: Reusable Empty State Component
**What:** Shared component following established DashboardEmptyState pattern
**When to use:** Every list page when data count is zero
**Example:**
```typescript
// apps/web/src/components/shared/empty-state.tsx
type EmptyStateProps = {
  icon: LucideIcon;
  heading: string;
  body: string;
  primaryAction?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href?: string; onClick?: () => void };
};

export function EmptyState({ icon: Icon, heading, body, primaryAction, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <Icon className="h-12 w-12 text-muted-foreground" />
      <h2 className="mt-4 text-[20px] font-semibold">{heading}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 flex gap-3">
        {primaryAction && <Button>{primaryAction.label}</Button>}
        {secondaryAction && <Button variant="outline">{secondaryAction.label}</Button>}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Client-side XLSX parsing for large files:** Do NOT parse 1000+ row files in the browser. Upload to server, parse server-side per D-04
- **Blocking onboarding modal:** Per D-05/D-07, wizard is never blocking. Always dismissible, collapses to checklist widget
- **Static empty states:** Per D-11, empty states must be context-aware. Don't show "Add a contract" if there are no contractors yet
- **Grouped search results:** Per D-16, results are flat with type badges, NOT grouped by category
- **Custom command palette:** cmdk is already installed with full component library. Do NOT build a custom implementation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command palette UI | Custom modal with keyboard nav | cmdk 1.1.1 (CommandDialog already in command.tsx) | Keyboard navigation, fuzzy matching, accessibility all handled |
| XLSX/CSV parsing | Custom CSV parser | xlsx 0.18.5 (already in deps) | Handles encoding, date formats, merged cells, BOM, both formats |
| Full-text search | Custom LIKE queries or JS filtering | PostgreSQL tsvector (already set up) | Weighted ranking, prefix matching, GIN index performance |
| Column auto-mapping | Simple exact match | Levenshtein/normalized similarity matching | Headers vary wildly ("Company Name", "company_name", "Legal Name", "Nazwa firmy") |
| Duplicate detection | Full table scan | Query by taxId/NIP index | Contractor.taxId is already indexed; batch query for all imported NIP values |

**Key insight:** Every major technical challenge in this phase already has an established pattern or installed library in the project. The work is integration and UX polish, not new infrastructure.

## Common Pitfalls

### Pitfall 1: XLSX Date Handling
**What goes wrong:** Excel stores dates as serial numbers (e.g., 45678 instead of "2025-01-15"). Raw parsing returns numbers, not date strings.
**Why it happens:** xlsx library returns raw cell values by default.
**How to avoid:** Use `{ cellDates: true }` option in `XLSX.read()` to auto-convert Excel date serial numbers to JavaScript Date objects. Then format to ISO string for Zod datetime validation.
**Warning signs:** Import preview shows numbers like 45678 in date columns.

### Pitfall 2: Polish Character Encoding in CSV
**What goes wrong:** Polish characters (ą, ę, ś, etc.) appear garbled in imported CSV files.
**Why it happens:** CSV files from Excel on Windows use Windows-1250 encoding, not UTF-8.
**How to avoid:** Detect encoding using BOM marker or heuristics. If no BOM, try UTF-8 first, fall back to Windows-1250 decoding. The existing export adds UTF-8 BOM -- imported files may or may not have it.
**Warning signs:** Characters like "Sp. z o.o." appear as garbled text.

### Pitfall 3: Command Palette Re-Renders
**What goes wrong:** The command palette causes unnecessary re-renders of the entire app tree when open/search state changes.
**Why it happens:** Placing palette state too high in the component tree.
**How to avoid:** Keep CommandPalette as a portal component at layout level with its own isolated state. Use React.memo or lazy loading. Debounce search queries (300ms recommended).
**Warning signs:** Typing in the palette causes visible lag or layout shifts.

### Pitfall 4: Empty State Flash
**What goes wrong:** Empty state flashes briefly before data loads, then disappears.
**Why it happens:** Checking `data.length === 0` during loading state shows empty state prematurely.
**How to avoid:** Only show empty state when `!isLoading && data.length === 0`. Show skeleton/loading state while fetching.
**Warning signs:** Brief flash of "No contractors yet" before the table renders.

### Pitfall 5: Import Wizard Memory with Large Files
**What goes wrong:** Browser tab crashes or freezes with 1000+ row imports.
**Why it happens:** Holding entire parsed dataset in client-side React state.
**How to avoid:** Per D-04, upload file to server for processing. Client only receives paginated preview results. Server stores parsed data temporarily (in-memory or temp table) until user commits.
**Warning signs:** Import wizard becomes unresponsive after file selection.

### Pitfall 6: Column Mapping State Complexity
**What goes wrong:** Column mapping UI becomes buggy with duplicate mappings or unmapped required fields.
**Why it happens:** Two-way binding between source columns and target fields without proper constraint validation.
**How to avoid:** Use a controlled mapping object `Record<sourceColumn, targetField | null>`. Validate that required target fields are mapped before allowing "Next". Show clear visual indicator for required vs optional target fields.
**Warning signs:** User can map two source columns to the same target field, or proceed without mapping required fields.

### Pitfall 7: Invoice Search Vector Missing
**What goes wrong:** Global search returns contractors and contracts but not invoices.
**Why it happens:** Invoice table does not have a tsvector column -- only Contractor and Contract have search vectors.
**How to avoid:** Create a new migration adding a search_vector to Invoice table (invoiceNumber, contractor name via join or denormalized field). Follow the exact pattern from contractor/contract migrations.
**Warning signs:** SRCH-01 partially working -- invoices never appear in results.

## Code Examples

### Reversing xlsx Export Pattern for Import
```typescript
// Source: packages/api/src/services/report-export.ts (reversed)
export async function parseImportFile(buffer: Buffer): Promise<Record<string, string>[]> {
  const { default: XLSX } = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in file");
  const sheet = workbook.Sheets[sheetName]!;
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "", // Default empty string for missing cells
    raw: false, // Return formatted strings, not raw values
  });
}
```

### Auto-Mapping Column Headers
```typescript
// Normalize header for fuzzy matching
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

// Known aliases for contractor fields
const CONTRACTOR_FIELD_ALIASES: Record<string, string[]> = {
  legalName: ["legalname", "companyname", "company", "name", "nazwa", "nazwafirmy", "firmaname"],
  taxId: ["taxid", "nip", "nipnumber", "taxidentification", "taxnumber"],
  email: ["email", "emailaddress", "mail", "kontakt"],
  displayName: ["displayname", "shortname", "tradingname", "nazwahandlowa"],
  // ... etc
};

function autoMapColumns(
  sourceHeaders: string[],
  fieldAliases: Record<string, string[]>,
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  for (const header of sourceHeaders) {
    const normalized = normalizeHeader(header);
    const match = Object.entries(fieldAliases).find(([, aliases]) =>
      aliases.includes(normalized)
    );
    mapping[header] = match ? match[0] : null;
  }
  return mapping;
}
```

### Command Palette with Recent Items and Navigation
```typescript
// apps/web/src/components/search/command-palette.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/trpc/init";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandShortcut,
} from "@/components/ui/command";
import { navigationItems } from "@/lib/navigation";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Cmd+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search query with debounce
  const { data: results } = useQuery({
    ...trpc.search.global.queryOptions({ query }),
    enabled: query.length >= 2,
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {/* Recent items shown when no query */}
        {!query && (
          <CommandGroup heading="Recent">
            {/* Recent items from localStorage or server */}
          </CommandGroup>
        )}
        {/* Search results */}
        {results?.map((item) => (
          <CommandItem key={`${item.type}-${item.id}`}
            onSelect={() => { router.push(getEntityUrl(item)); setOpen(false); }}>
            <TypeBadge type={item.type} />
            <span>{item.name}</span>
          </CommandItem>
        ))}
        {/* Navigation pages */}
        <CommandGroup heading="Pages">
          {navigationItems.filter(n =>
            n.label.toLowerCase().includes(query.toLowerCase())
          ).map((item) => (
            <CommandItem key={item.key}
              onSelect={() => { router.push(item.href); setOpen(false); }}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

### Onboarding Checklist Widget
```typescript
// apps/web/src/components/onboarding/onboarding-checklist.tsx
const ONBOARDING_STEPS = [
  { id: "org-details", label: "Complete organization details", href: "/settings", optional: false },
  { id: "invite-team", label: "Invite your team", href: "/settings/members", optional: false },
  { id: "add-contractor", label: "Add your first contractor", href: "/contractors", optional: false },
  { id: "configure-approvals", label: "Set up approval chains", href: "/settings", optional: true },
  { id: "connect-slack", label: "Connect Slack", href: "/integrations", optional: true },
] as const;

// Widget renders as a Card on the dashboard
// Reads completedSteps from settings.get query
// Marks step complete via settings.update mutation (settingsJson merge)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side CSV parsing | Server-side with streaming | 2024+ | Required for 1000+ row imports per D-04 |
| kbar for command palette | cmdk (more lightweight, React 19 compatible) | 2024 | cmdk is already installed in this project |
| Grouped search results | Flat ranked results with type badges | Linear/Vercel pattern | Better UX per D-16 decision |
| Blocking onboarding modals | Non-blocking checklist widgets | Stripe/Linear pattern | Better UX per D-05 decision |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via packages/api/vitest.config.ts) |
| Config file | packages/api/vitest.config.ts |
| Quick run command | `cd packages/api && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/api && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | CSV/XLSX parsing + column auto-mapping | unit | `cd packages/api && npx vitest run src/services/__tests__/import-processor.test.ts -x` | No -- Wave 0 |
| IMP-02 | Row validation against Zod schemas + error reporting | unit | `cd packages/api && npx vitest run src/services/__tests__/import-processor.test.ts -x` | No -- Wave 0 |
| IMP-03 | Contract import with contractor foreign key resolution | unit | `cd packages/api && npx vitest run src/services/__tests__/import-processor.test.ts -x` | No -- Wave 0 |
| ONBD-01 | Onboarding step completion persistence | unit | `cd packages/api && npx vitest run src/routers/__tests__/settings.test.ts -x` | No -- Wave 0 |
| ONBD-02 | Empty state rendering (smart sequencing logic) | manual-only | Visual verification across all views | N/A |
| SRCH-01 | Global search returns results from all 3 entity types | unit | `cd packages/api && npx vitest run src/routers/__tests__/search.test.ts -x` | No -- Wave 0 |
| SRCH-02 | Command palette keyboard shortcuts and navigation | manual-only | Keyboard interaction testing | N/A |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/import-processor.test.ts` -- covers IMP-01, IMP-02, IMP-03 (parsing, validation, duplicate detection)
- [ ] `packages/api/src/routers/__tests__/search.test.ts` -- covers SRCH-01 (unified search endpoint)

## Open Questions

1. **Invoice search vector migration**
   - What we know: Contractor and Contract tables have tsvector columns. Invoice does not.
   - What's unclear: Which Invoice fields to include in the search vector. InvoiceNumber is obvious; should contractor name be denormalized into the vector?
   - Recommendation: Create migration with `invoiceNumber` (weight A) + include contractor legal name via a trigger-based approach or denormalized column. Simpler: just use invoiceNumber + notes for the vector, and do a separate contractor join in the search query for invoice results.

2. **Recent items storage for command palette (D-15)**
   - What we know: Need to track last 5-10 viewed entities per user.
   - What's unclear: Whether to store in localStorage (simpler, per-device) or server-side (cross-device).
   - Recommendation: Use localStorage for recent items (simpler, no migration needed). Use a separate `UserFavorite` concept for pinned items if server persistence is needed -- but localStorage is sufficient for v1 recent items.

3. **Async import status polling mechanism (D-04)**
   - What we know: Large imports need server-side processing with client polling.
   - What's unclear: Whether to use a database-backed job queue or in-memory processing.
   - Recommendation: For v1, use a simple approach: upload file -> server parses synchronously in the tRPC mutation (xlsx parsing of 1000 rows is fast, under 1s) -> return full result. True async with polling only needed if parsing takes > 5s, which is unlikely for spreadsheet sizes. If needed, store import job status in a temporary database record and poll via tRPC query with refetchInterval.

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/api/src/services/report-export.ts` -- xlsx usage pattern for export (reverse for import)
- Project codebase: `apps/web/src/components/ui/command.tsx` -- cmdk component library
- Project codebase: `apps/web/src/components/contractors/contractor-wizard/wizard-dialog.tsx` -- wizard dialog pattern
- Project codebase: `packages/db/prisma/schema/migrations/20260320120000_add_contractor_search_vector/migration.sql` -- tsvector migration pattern
- Project codebase: `packages/api/src/routers/contractor.ts` lines 183-207 -- tsvector search query pattern
- npm registry: cmdk@1.1.1, xlsx@0.18.5 -- verified current versions

### Secondary (MEDIUM confidence)
- Established project patterns: settingsJson merge for org-level config, fire-and-forget async, local wizard Zod schemas

### Tertiary (LOW confidence)
- None -- all findings based on existing project code and installed libraries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and patterns established in project
- Architecture: HIGH -- follows existing project patterns (wizard-dialog, tsvector, settingsJson, data-table)
- Pitfalls: HIGH -- derived from actual project patterns and xlsx library behavior

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- all dependencies locked, patterns established)
