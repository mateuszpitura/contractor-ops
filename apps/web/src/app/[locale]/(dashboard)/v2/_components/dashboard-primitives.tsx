"use client";

import { AlertTriangle, CalendarClock, FileCheck } from "lucide-react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";

// =============================================================================
// MESH BACKGROUND — three drifting color orbs + grain + diagonal stripe
// =============================================================================

export function AtelierBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* ── Top wash — warm-to-cool gradient across the page ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(170deg, color-mix(in oklch, var(--color-primary) 5%, transparent) 0%, transparent 40%, color-mix(in oklch, oklch(0.6 0.15 270) 3%, transparent) 100%)",
        }}
      />

      {/* ── Gradient orbs — large, visible, drifting ── */}
      <div
        className="absolute -start-[10%] -top-[10%] h-[800px] w-[800px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 22%, transparent) 0%, transparent 65%)",
          animation: "drift-1 28s ease-in-out infinite",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute -end-[5%] top-[10%] h-[650px] w-[650px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, oklch(0.78 0.14 55) 16%, transparent) 0%, transparent 65%)",
          animation: "drift-2 35s ease-in-out infinite",
          filter: "blur(100px)",
        }}
      />
      <div
        className="absolute bottom-[-5%] start-[35%] h-[550px] w-[550px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, oklch(0.55 0.2 270) 12%, transparent) 0%, transparent 65%)",
          animation: "drift-3 24s ease-in-out infinite",
          filter: "blur(90px)",
        }}
      />

      {/* ── Grain texture ── */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      {/* ── Subtle dot grid ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--color-muted-foreground) 0.5px, transparent 0.5px)",
          backgroundSize: "32px 32px",
          opacity: 0.04,
        }}
      />

      {/* ── Diagonal lines (architectural accent) ── */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--color-foreground) 0px, var(--color-foreground) 1px, transparent 1px, transparent 80px)",
        }}
      />
    </div>
  );
}

// =============================================================================
// TILT CARD — 3D perspective tilt that follows cursor
// =============================================================================

export function TiltCard({
  children,
  className = "",
  delay = 0,
  href,
  glow = false,
  shimmer = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  href?: string;
  glow?: boolean;
  shimmer?: boolean;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${y * -4}deg) translateY(-2px)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) translateY(0px)";
  }, []);

  const classes = [
    "atelier-enter atelier-glass group relative rounded-2xl p-5",
    glow ? "atelier-border-glow" : "",
    shimmer ? "atelier-shimmer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <div
      ref={ref}
      className={classes}
      style={{
        animationDelay: `${delay}ms`,
        transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease",
        transformStyle: "preserve-3d",
        willChange: "transform",
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// =============================================================================
// ANIMATED NUMBER
// =============================================================================

export function AnimatedNumber({
  value,
  duration = 1600,
  format,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = p === 1 ? 1 : 1 - 2 ** (-12 * p);
      setDisplay(Math.round(eased * value));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return <>{format ? format(display) : display.toLocaleString("pl-PL")}</>;
}

// =============================================================================
// RING PROGRESS
// =============================================================================

export function Ring({
  value,
  max,
  color,
  size = 48,
  stroke = 3.5,
  children,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max === 0 ? 0 : Math.min(value / max, 1);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 1.6s cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

// =============================================================================
// SPARKLINE
// =============================================================================

export function Sparkline({
  data,
  w = 180,
  h = 52,
  color = "var(--color-primary)",
  id = "sp",
}: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  id?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 4;
  const toY = (v: number) => pad + (1 - (v - min) / range) * (h - pad * 2);
  const step = w / Math.max(data.length - 1, 1);

  const line = data.map((v, i) => `${i * step},${toY(v)}`).join(" ");
  const area = `0,${h} ${data.map((v, i) => `${i * step},${toY(v)}`).join(" ")} ${w},${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id}-g)`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={w} cy={toY(data[data.length - 1])} r={4} fill={color} opacity={0.9}>
        <animate attributeName="r" values="4;6;4" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// =============================================================================
// LIVE CLOCK (SSR-safe)
// =============================================================================

export function LiveClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!t)
    return <span className="font-mono text-xs tabular-nums text-muted-foreground">--:--</span>;
  const h = t.getHours().toString().padStart(2, "0");
  const m = t.getMinutes().toString().padStart(2, "0");
  const s = t.getSeconds().toString().padStart(2, "0");
  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground/70">
      {h}
      <span className="animate-pulse text-primary">:</span>
      {m}
      <span className="text-[9px] text-muted-foreground/40">.{s}</span>
    </span>
  );
}

// =============================================================================
// STATUS DOT WITH PULSE
// =============================================================================

export function PulseDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && (
        <span
          className="absolute inset-0 rounded-full opacity-75"
          style={{
            backgroundColor: color,
            animation: "ring-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

// =============================================================================
// SLA PILL
// =============================================================================

const SLA_CFG: Record<string, { color: string; label: string }> = {
  ON_TRACK: { color: "oklch(0.65 0.2 155)", label: "On track" },
  APPROACHING: { color: "oklch(0.75 0.17 65)", label: "Approaching" },
  BREACHED: { color: "oklch(0.65 0.25 25)", label: "Breached" },
};

export function SlaPill({ status }: { status: string }) {
  const c = SLA_CFG[status] ?? SLA_CFG.ON_TRACK;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
      style={{ color: c.color, background: `color-mix(in oklch, ${c.color} 10%, transparent)` }}
    >
      <PulseDot color={c.color} pulse={status === "BREACHED"} />
      {c.label}
    </span>
  );
}

// =============================================================================
// DEADLINE HELPERS
// =============================================================================

export const DL_CFG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  CONTRACT_EXPIRING: { icon: CalendarClock, color: "var(--color-warning)" },
  TASK_OVERDUE: { icon: AlertTriangle, color: "var(--color-destructive)" },
  INVOICE_DUE: { icon: FileCheck, color: "var(--color-info)" },
};

export function dlHref(type: string, id: string) {
  return type === "CONTRACT_EXPIRING"
    ? `/contracts/${id}`
    : type === "INVOICE_DUE"
      ? `/invoices/${id}`
      : "/workflows?tab=my-tasks";
}

// =============================================================================
// CURRENCY FORMATTERS
// =============================================================================

export const plnFmt = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const fmtAmt = (g: number, cur = "PLN") =>
  cur !== "PLN"
    ? new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: cur,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(g / 100)
    : plnFmt.format(g / 100);

// =============================================================================
// SECTION LABEL — editorial-style section headers
// =============================================================================

export function SectionLabel({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2.5 ps-1">
      {Icon && (
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/8">
          <Icon className="h-3 w-3 text-primary" />
        </div>
      )}
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
        {children}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
    </div>
  );
}
