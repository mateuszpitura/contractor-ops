"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
  type ReactNode,
  type MouseEvent as RME,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsInteger, useQueryState } from "nuqs";
import {
  Search,
  Users,
  ChevronRight,
  ArrowUpRight,
  Plus,
  Upload,
  Filter,
  LayoutGrid,
  LayoutList,
  CheckCircle,
  AlertTriangle as AlertTriangleIcon,
  XCircle,
  Building2,
  User,
  Briefcase,
  Hash,
  Mail,
  Wallet,
  Shield,
  Clock,
  ChevronLeft,
} from "lucide-react";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { WizardDialog } from "@/components/contractors/contractor-wizard/wizard-dialog";

// =============================================================================
// DESIGN UTILITIES
// =============================================================================

/** Deterministic color from string — generates a consistent hue for avatar gradients */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function avatarGradient(name: string): string {
  const h = nameToHue(name);
  return `linear-gradient(135deg, oklch(0.65 0.15 ${h}) 0%, oklch(0.50 0.18 ${(h + 40) % 360}) 100%)`;
}

// =============================================================================
// ANIMATED BACKGROUND (shared with dashboard v2)
// =============================================================================

function AtelierBg() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(170deg, color-mix(in oklch, var(--color-primary) 4%, transparent) 0%, transparent 40%, color-mix(in oklch, oklch(0.6 0.15 270) 2%, transparent) 100%)",
        }}
      />
      <div
        className="absolute -start-[10%] -top-[10%] h-[700px] w-[700px] rounded-full"
        style={{
          background: "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 18%, transparent) 0%, transparent 65%)",
          animation: "drift-1 28s ease-in-out infinite",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute -end-[5%] top-[20%] h-[500px] w-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, color-mix(in oklch, oklch(0.78 0.14 55) 12%, transparent) 0%, transparent 65%)",
          animation: "drift-2 35s ease-in-out infinite",
          filter: "blur(100px)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, var(--color-muted-foreground) 0.5px, transparent 0.5px)",
          backgroundSize: "32px 32px",
          opacity: 0.04,
        }}
      />
    </div>
  );
}

// =============================================================================
// TILT CARD (shared pattern)
// =============================================================================

function TiltCard({
  children,
  className = "",
  delay = 0,
  href,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  href?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: RME<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 3}deg) rotateX(${y * -3}deg) translateY(-2px)`;
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0) rotateX(0) translateY(0)";
  }, []);

  const inner = (
    <div
      ref={ref}
      className={`atelier-enter atelier-glass group relative rounded-2xl p-5 transition-[transform,box-shadow] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.25)] ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {children}
    </div>
  );

  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// =============================================================================
// SECTION LABEL
// =============================================================================

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 ps-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">{children}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
    </div>
  );
}

// =============================================================================
// LIFECYCLE BADGE
// =============================================================================

const LIFECYCLE_STYLES: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-muted", text: "text-muted-foreground" },
  ONBOARDING: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  ACTIVE: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  OFFBOARDING: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  ENDED: { bg: "bg-muted", text: "text-muted-foreground" },
};

function LifecycleBadge({ stage }: { stage: string }) {
  const s = LIFECYCLE_STYLES[stage] ?? LIFECYCLE_STYLES.DRAFT;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${s.bg} ${s.text}`}>
      {stage.replace("_", " ")}
    </span>
  );
}

// =============================================================================
// COMPLIANCE DOT
// =============================================================================

function ComplianceDot({ health }: { health: string }) {
  const cfg: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
    green: { color: "text-emerald-500", icon: CheckCircle, label: "Healthy" },
    yellow: { color: "text-amber-500", icon: AlertTriangleIcon, label: "Caution" },
    red: { color: "text-red-500", icon: XCircle, label: "At Risk" },
  };
  const c = cfg[health] ?? cfg.green;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${c.color}`} title={c.label}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

// =============================================================================
// TYPE ICON
// =============================================================================

const TYPE_ICONS: Record<string, typeof Building2> = {
  COMPANY: Building2,
  SOLE_TRADER: User,
  INDIVIDUAL_FREELANCER: Briefcase,
  OTHER: Hash,
};

// =============================================================================
// CURRENCY FORMAT
// =============================================================================

function fmtRate(minor: number, currency = "PLN") {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// =============================================================================
// STATS STRIP — quick overview counters
// =============================================================================

function StatsStrip({
  total,
  byStage,
}: {
  total: number;
  byStage: Record<string, number>;
}) {
  const stats = [
    { label: "Total", value: total, color: "var(--color-foreground)" },
    { label: "Active", value: byStage.ACTIVE ?? 0, color: "var(--color-success)" },
    { label: "Onboarding", value: byStage.ONBOARDING ?? 0, color: "var(--color-info)" },
    { label: "Offboarding", value: byStage.OFFBOARDING ?? 0, color: "var(--color-warning)" },
    { label: "Draft", value: byStage.DRAFT ?? 0, color: "var(--color-muted-foreground)" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-5">
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline gap-1.5">
          <span className="font-display text-[22px] font-black leading-none tracking-tight" style={{ color: s.color }}>
            {s.value}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// FILTER PILLS — horizontal toggles
// =============================================================================

const STAGE_FILTERS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "OFFBOARDING", label: "Offboarding" },
  { value: "DRAFT", label: "Draft" },
  { value: "ENDED", label: "Ended" },
];

// =============================================================================
// CONTRACTOR CARD — the star of the show
// =============================================================================

interface ContractorCardData {
  id: string;
  legalName: string;
  displayName: string | null;
  type: string;
  status: string;
  lifecycleStage: string;
  currency: string;
  email: string | null;
  taxId: string | null;
  customFieldsJson: Record<string, unknown> | null;
  owner: { id: string; name: string | null; image: string | null } | null;
  primaryTeam: { id: string; name: string } | null;
  complianceHealth: "green" | "yellow" | "red";
  updatedAt: string | null;
}

function ContractorCard({ c, index }: { c: ContractorCardData; index: number }) {
  const name = c.displayName || c.legalName;
  const TypeIcon = TYPE_ICONS[c.type] ?? Hash;
  const rate = (c.customFieldsJson?.rateValueMinor as number) ?? 0;
  const billingModel = (c.customFieldsJson?.billingModel as string) ?? "";

  return (
    <TiltCard
      delay={80 + index * 40}
      href={`/contractors/${c.id}`}
      className="atelier-shimmer cursor-pointer"
    >
      <div className="flex flex-col gap-4">
        {/* Top row: avatar + status + compliance */}
        <div className="flex items-start gap-3">
          {/* Gradient avatar */}
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-black text-white shadow-lg transition-transform group-hover:scale-105"
            style={{ background: avatarGradient(name) }}
          >
            {name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-bold leading-tight tracking-tight">
              {name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <TypeIcon className="h-3 w-3" />
                {c.type.replace(/_/g, " ").toLowerCase()}
              </span>
            </div>
          </div>

          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-all group-hover:text-primary/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>

        {/* Middle: badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <LifecycleBadge stage={c.lifecycleStage} />
          <ComplianceDot health={c.complianceHealth} />
        </div>

        {/* Divider */}
        <div className="h-px bg-border/30" />

        {/* Bottom: key details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {/* Rate */}
          {rate > 0 && (
            <div className="flex items-center gap-1.5">
              <Wallet className="h-3 w-3 text-muted-foreground/40" />
              <span className="font-mono text-[12px] font-bold tabular-nums tracking-tight">
                {fmtRate(rate, c.currency)}
              </span>
              {billingModel && (
                <span className="text-[9px] text-muted-foreground/40">/{billingModel.toLowerCase().slice(0, 3)}</span>
              )}
            </div>
          )}

          {/* Email */}
          {c.email && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <span className="truncate text-[11px] text-muted-foreground/60">{c.email}</span>
            </div>
          )}

          {/* Owner */}
          {c.owner?.name && (
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground/40" />
              <span className="truncate text-[11px] text-muted-foreground/60">{c.owner.name}</span>
            </div>
          )}

          {/* Team */}
          {c.primaryTeam?.name && (
            <div className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-muted-foreground/40" />
              <span className="truncate text-[11px] text-muted-foreground/60">{c.primaryTeam.name}</span>
            </div>
          )}
        </div>

        {/* NIP / Tax ID subtle footer */}
        {c.taxId && (
          <div className="flex items-center gap-1.5">
            <Hash className="h-2.5 w-2.5 text-muted-foreground/25" />
            <span className="font-mono text-[10px] text-muted-foreground/30 tracking-wider">
              NIP {c.taxId.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, "$1-$2-$3-$4")}
            </span>
          </div>
        )}
      </div>
    </TiltCard>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

function ContractorsV2Content() {
  const t = useTranslations("Contractors");

  // ── URL state ──
  const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
  const [stage, setStage] = useQueryState("stage", parseAsString.withDefault(""));
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const pageSize = 24; // cards look best in multiples of 2/3/4

  // ── Wizard ──
  const [wizardOpen, setWizardOpen] = useState(false);

  // ── Debounced search ──
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timerRef.current);
  }, [search]);

  // ── Data ──
  const { data, isLoading, isRefetching } = useQuery(
    trpc.contractor.list.queryOptions({
      page,
      pageSize,
      search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
      filters: stage ? { lifecycleStage: [stage as "DRAFT" | "ONBOARDING" | "ACTIVE" | "OFFBOARDING" | "ENDED"] } : undefined,
    }),
  );

  const contractors = (data?.items ?? []) as unknown as ContractorCardData[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  // ── Compute stage counts from full unfiltered query (separate lightweight call) ──
  const { data: allData } = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 1 }),
  );
  const allTotal = allData?.total ?? 0;

  // Approximate stage counts from current view (not perfect but avoids extra queries)
  const byStage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contractors) counts[c.lifecycleStage] = (counts[c.lifecycleStage] ?? 0) + 1;
    return counts;
  }, [contractors]);

  // ── Empty state ──
  if (!isLoading && allTotal === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/8">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mt-5 font-display text-[24px] font-bold tracking-tight">No contractors yet</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Add your first contractor to start managing contracts, invoices, and payments.
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="me-1.5 h-4 w-4" /> Add contractor
          </Button>
          <Button variant="outline">
            <Upload className="me-1.5 h-4 w-4" /> Import
          </Button>
        </div>
        <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <TiltCard delay={0} className="atelier-border-glow">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h1 className="font-display text-[28px] font-black tracking-tight">Contractors</h1>
            </div>
            <StatsStrip total={allTotal} byStage={byStage} />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs">
              <Upload className="me-1.5 h-3.5 w-3.5" /> Import
            </Button>
            <Button size="sm" className="text-xs" onClick={() => setWizardOpen(true)}>
              <Plus className="me-1.5 h-3.5 w-3.5" /> Add contractor
            </Button>
          </div>
        </div>
      </TiltCard>

      {/* ================================================================ */}
      {/* FILTERS + SEARCH BAR                                             */}
      {/* ================================================================ */}
      <div className="atelier-enter flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: "100ms" }}>
        {/* Stage filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => { setStage(f.value); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-all ${
                stage === f.value
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-muted/30 text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search contractors..."
            className="h-9 w-full rounded-xl border border-border/40 bg-card/50 ps-9 pe-4 text-[12px] font-medium text-foreground placeholder:text-muted-foreground/40 backdrop-blur-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 sm:w-[260px]"
          />
        </div>
      </div>

      {/* ================================================================ */}
      {/* CONTRACTOR GRID                                                  */}
      {/* ================================================================ */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px] rounded-2xl" />
          ))}
        </div>
      ) : contractors.length === 0 ? (
        <div className="atelier-enter atelier-glass rounded-2xl py-16 text-center">
          <Filter className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No contractors match your filters</p>
          <button
            type="button"
            onClick={() => { setSearch(""); setStage(""); setPage(1); }}
            className="mt-2 text-xs font-semibold text-primary hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <>
          {/* Refetching indicator */}
          {isRefetching && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <div className="h-3 w-3 animate-spin rounded-full border border-primary/20 border-t-primary" />
              Updating...
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {contractors.map((c, i) => (
              <ContractorCard key={c.id} c={c} index={i} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="atelier-enter flex items-center justify-center gap-4 pt-2" style={{ animationDelay: "200ms" }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[11px] font-bold tabular-nums text-muted-foreground/60">
                {page} <span className="text-muted-foreground/30">of</span> {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground transition-all hover:bg-muted/30 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      <WizardDialog open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

// =============================================================================
// PAGE WRAPPER
// =============================================================================

export default function ContractorsV2Page() {
  return (
    <div className="relative -m-6 min-h-screen">
      <AtelierBg />
      <div className="relative z-10 p-6 lg:p-8">
        <Suspense
          fallback={
            <div className="space-y-6">
              <Skeleton className="h-[140px] rounded-2xl" />
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-20 rounded-full" />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[220px] rounded-2xl" />
                ))}
              </div>
            </div>
          }
        >
          <ContractorsV2Content />
        </Suspense>
      </div>
    </div>
  );
}
