import type { SVGProps } from 'react';
import { useId } from 'react';

type IllustrationProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

/**
 * Contextual empty-state illustrations with solid fills, depth, and
 * SVG `<mask>` knockout technique so overlapping transparent elements
 * never blend — the front element cleanly covers the one behind it,
 * like CSS z-index but for transparent SVG shapes.
 *
 * All colours derive from `currentColor` via the parent wrapper.
 * Each component uses `useId()` for unique SVG def IDs.
 *
 * Default size 96 x 96; parents override via `className`.
 */

const DEFAULTS: SVGProps<SVGSVGElement> = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 96,
  height: 96,
  fill: 'none',
  role: 'presentation',
};

/* ── Invoices ──────────────────────────────────────────────────────── */

export function InvoicesIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const g3 = `${uid}-c`;
  const mBack = `${uid}-mb`;
  const mFront = `${uid}-mf`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={g3} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.38" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </linearGradient>
        <mask id={mBack}>
          <rect width="96" height="96" fill="white" />
          <rect x="14" y="18" width="50" height="64" rx="6" fill="black" />
          <circle cx="68" cy="22" r="15" fill="black" />
        </mask>
        <mask id={mFront}>
          <rect width="96" height="96" fill="white" />
          <circle cx="68" cy="22" r="15" fill="black" />
        </mask>
      </defs>

      <ellipse cx="38" cy="82" rx="26" ry="4" fill="currentColor" fillOpacity={0.06} />

      <g mask={`url(#${mBack})`}>
        <rect
          x="28"
          y="12"
          width="42"
          height="56"
          rx="5"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      </g>

      <g mask={`url(#${mFront})`} filter={`url(#${s})`}>
        <rect
          x="16"
          y="20"
          width="46"
          height="60"
          rx="5"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1.2}
        />
        <rect x="16" y="20" width="46" height="11" rx="5" fill="currentColor" fillOpacity={0.08} />
        <rect
          x="24"
          y="38"
          width="22"
          height="2.5"
          rx="1.25"
          fill="currentColor"
          fillOpacity={0.25}
        />
        <rect x="24" y="44" width="30" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect x="24" y="50" width="26" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect
          x="24"
          y="60"
          width="30"
          height="0.8"
          rx="0.4"
          fill="currentColor"
          fillOpacity={0.08}
        />
        <rect x="34" y="66" width="20" height="3" rx="1.5" fill="currentColor" fillOpacity={0.2} />
      </g>

      <circle
        cx="68"
        cy="22"
        r="13"
        fill={`url(#${g3})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <text
        x="68"
        y="27"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity={0.7}
        fontSize="14"
        fontWeight="700"
        fontFamily="inherit">
        {'€'}
      </text>
    </svg>
  );
}

/* ── Contracts ─────────────────────────────────────────────────────── */

export function ContractsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mDoc = `${uid}-md`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={g2} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
        <mask id={mDoc}>
          <rect width="96" height="96" fill="white" />
          <circle cx="74" cy="70" r="16" fill="black" />
        </mask>
      </defs>

      <ellipse cx="42" cy="82" rx="28" ry="4" fill="currentColor" fillOpacity={0.06} />

      <g mask={`url(#${mDoc})`} filter={`url(#${s})`}>
        <rect
          x="20"
          y="8"
          width="48"
          height="68"
          rx="5"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1.2}
        />
        <rect x="20" y="8" width="48" height="13" rx="5" fill="currentColor" fillOpacity={0.08} />
        <rect x="28" y="28" width="32" height="2" rx="1" fill="currentColor" fillOpacity={0.18} />
        <rect x="28" y="34" width="28" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect x="28" y="40" width="30" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect x="28" y="46" width="22" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />
        <line
          x1="28"
          y1="58"
          x2="52"
          y2="58"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.8}
          strokeDasharray="3 2"
        />
        <path
          d="M30 56 C33 51, 37 61, 41 54 C43 52, 46 58, 50 55"
          stroke="currentColor"
          strokeOpacity={0.4}
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
        />
      </g>

      <circle
        cx="74"
        cy="70"
        r="14"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <circle
        cx="74"
        cy="70"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={0.7}
      />
      <path
        d="M69 70 L73 74 L80 65"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Contractors / People ──────────────────────────────────────────── */

export function ContractorsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mBg = `${uid}-mb`;
  const mFg = `${uid}-mf`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <radialGradient id={g1} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </radialGradient>
        <radialGradient id={g2} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </radialGradient>
        <mask id={mBg}>
          <rect width="96" height="96" fill="white" />
          <circle cx="56" cy="30" r="13" fill="black" />
          <path d="M38 76 C38 52, 46 42, 56 42 C66 42, 74 52, 74 76 L38 76" fill="black" />
          <circle cx="78" cy="24" r="12" fill="black" />
        </mask>
        <mask id={mFg}>
          <rect width="96" height="96" fill="white" />
          <circle cx="78" cy="24" r="12" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${mBg})`}>
        <circle
          cx="34"
          cy="34"
          r="9"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
        <path
          d="M19 72 C19 57, 26 49, 34 49 C42 49, 49 57, 49 72"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>

      <g mask={`url(#${mFg})`} filter={`url(#${s})`}>
        <circle
          cx="56"
          cy="30"
          r="11"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1.2}
        />
        <path
          d="M39 72 C39 54, 47 44, 56 44 C65 44, 73 54, 73 72"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </g>

      <circle
        cx="78"
        cy="24"
        r="10"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <path
        d="M76.8 20.5 Q76.8 19.5, 78 19.5 Q79.2 19.5, 79.2 20.5 L79.2 22.8 L81.5 22.8 Q82.5 22.8, 82.5 24 Q82.5 25.2, 81.5 25.2 L79.2 25.2 L79.2 27.5 Q79.2 28.5, 78 28.5 Q76.8 28.5, 76.8 27.5 L76.8 25.2 L74.5 25.2 Q73.5 25.2, 73.5 24 Q73.5 22.8, 74.5 22.8 L76.8 22.8 Z"
        fill="currentColor"
        fillOpacity={0.65}
      />
    </svg>
  );
}

/* ── Payments ──────────────────────────────────────────────────────── */

export function PaymentsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mCard = `${uid}-mc`;
  const mC1 = `${uid}-c1`;
  const mC2 = `${uid}-c2`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={g2} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </linearGradient>
        <mask id={mCard}>
          <rect width="96" height="96" fill="white" />
          <ellipse cx="76" cy="54" rx="14" ry="7" fill="black" />
          <ellipse cx="76" cy="48" rx="14" ry="7" fill="black" />
          <ellipse cx="76" cy="42" rx="14" ry="7" fill="black" />
        </mask>
        <mask id={mC1}>
          <rect width="96" height="96" fill="white" />
          <ellipse cx="76" cy="48" rx="13" ry="6" fill="black" />
        </mask>
        <mask id={mC2}>
          <rect width="96" height="96" fill="white" />
          <ellipse cx="76" cy="42" rx="13" ry="6" fill="black" />
        </mask>
      </defs>

      <ellipse cx="40" cy="74" rx="28" ry="4" fill="currentColor" fillOpacity={0.06} />

      <g mask={`url(#${mCard})`} filter={`url(#${s})`}>
        <rect
          x="8"
          y="24"
          width="56"
          height="40"
          rx="6"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1.3}
        />
        <rect x="8" y="34" width="56" height="8" fill="currentColor" fillOpacity={0.12} />
        <rect
          x="16"
          y="48"
          width="11"
          height="9"
          rx="2.5"
          fill="currentColor"
          fillOpacity={0.2}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.7}
        />
        {[40, 46, 52].map(cx => (
          <circle key={cx} cx={cx} cy="54" r="1.8" fill="currentColor" fillOpacity={0.18} />
        ))}
      </g>

      <g mask={`url(#${mC1})`}>
        <ellipse
          cx="76"
          cy="54"
          rx="12"
          ry="5"
          fill="currentColor"
          fillOpacity={0.12}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.8}
        />
      </g>
      <g mask={`url(#${mC2})`}>
        <ellipse
          cx="76"
          cy="48"
          rx="12"
          ry="5"
          fill="currentColor"
          fillOpacity={0.2}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={0.9}
        />
      </g>
      <ellipse
        cx="76"
        cy="42"
        rx="12"
        ry="5"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.1}
        filter={`url(#${s})`}
      />
    </svg>
  );
}

/* ── Approvals ─────────────────────────────────────────────────────── */

export function ApprovalsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mBoard = `${uid}-mb`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
        <radialGradient id={g2} cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </radialGradient>
        <mask id={mBoard}>
          <rect width="96" height="96" fill="white" />
          <rect x="36" y="2" width="24" height="15" rx="4.5" fill="black" />
        </mask>
      </defs>

      <ellipse cx="48" cy="86" rx="28" ry="4" fill="currentColor" fillOpacity={0.06} />

      <g mask={`url(#${mBoard})`} filter={`url(#${s})`}>
        <rect
          x="24"
          y="16"
          width="48"
          height="66"
          rx="5"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1.2}
        />
      </g>

      <rect
        x="38"
        y="4"
        width="20"
        height="11"
        rx="3.5"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1.1}
      />
      <rect x="44" y="8" width="8" height="3" rx="1.5" fill="currentColor" fillOpacity={0.1} />

      <rect
        x="32"
        y="30"
        width="12"
        height="12"
        rx="3"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
      />
      <path
        d="M35 36 L37.5 38.5 L42 33"
        stroke="currentColor"
        strokeOpacity={0.65}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="50"
        y="34"
        width="14"
        height="2.5"
        rx="1.25"
        fill="currentColor"
        fillOpacity={0.15}
      />

      <rect
        x="32"
        y="48"
        width="12"
        height="12"
        rx="3"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
      />
      <path
        d="M35 54 L37.5 56.5 L42 51"
        stroke="currentColor"
        strokeOpacity={0.65}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="50"
        y="52"
        width="12"
        height="2.5"
        rx="1.25"
        fill="currentColor"
        fillOpacity={0.12}
      />

      <rect
        x="32"
        y="66"
        width="12"
        height="12"
        rx="3"
        fill="currentColor"
        fillOpacity={0.06}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={1}
        strokeDasharray="2.5 2"
      />
      <rect
        x="50"
        y="70"
        width="10"
        height="2.5"
        rx="1.25"
        fill="currentColor"
        fillOpacity={0.08}
      />
    </svg>
  );
}

/* ── Equipment ─────────────────────────────────────────────────────── */

export function EquipmentIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const g3 = `${uid}-c`;
  const mScreen = `${uid}-ms`;
  const mBase = `${uid}-mb`;
  const mPhone = `${uid}-mp`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id={g3} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </radialGradient>
        <mask id={mScreen}>
          <rect width="96" height="96" fill="white" />
          <path d="M6 52 L76 52 L76 66 L2 66 Z" fill="black" />
          <rect x="70" y="32" width="20" height="32" rx="6" fill="black" />
          <circle cx="76" cy="22" r="10" fill="black" />
        </mask>
        <mask id={mBase}>
          <rect width="96" height="96" fill="white" />
          <rect x="70" y="32" width="20" height="32" rx="6" fill="black" />
        </mask>
        <mask id={mPhone}>
          <rect width="96" height="96" fill="white" />
          <circle cx="76" cy="22" r="10" fill="black" />
        </mask>
      </defs>

      <ellipse cx="42" cy="72" rx="30" ry="4" fill="currentColor" fillOpacity={0.06} />

      <g mask={`url(#${mScreen})`} filter={`url(#${s})`}>
        <rect
          x="14"
          y="18"
          width="52"
          height="36"
          rx="4"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1.2}
        />
        <rect x="18" y="22" width="44" height="28" rx="2" fill="currentColor" fillOpacity={0.08} />
        <rect x="24" y="30" width="18" height="2" rx="1" fill="currentColor" fillOpacity={0.18} />
        <rect x="24" y="35" width="28" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />
        <rect x="24" y="40" width="22" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />
      </g>

      <g mask={`url(#${mBase})`}>
        <path
          d="M8 54 L14 54 L66 54 L72 54 L74 58 Q74 62, 72 62 L6 62 Q4 62, 4 58 Z"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <rect x="34" y="56" width="12" height="3" rx="1.5" fill="currentColor" fillOpacity={0.08} />
      </g>

      <g mask={`url(#${mPhone})`} filter={`url(#${s})`}>
        <rect
          x="72"
          y="34"
          width="16"
          height="28"
          rx="4"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1.2}
        />
        <rect
          x="74"
          y="38"
          width="12"
          height="18"
          rx="1.5"
          fill="currentColor"
          fillOpacity={0.06}
        />
        <circle cx="80" cy="59" r="1.5" fill="currentColor" fillOpacity={0.15} />
      </g>

      <circle
        cx="76"
        cy="22"
        r="8"
        fill={`url(#${g3})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1.1}
        filter={`url(#${s})`}
      />
      <circle cx="76" cy="22" r="2.5" fill="currentColor" fillOpacity={0.3} />
    </svg>
  );
}

/* ── Workflows ─────────────────────────────────────────────────────── */

export function WorkflowsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mConn = `${uid}-mc`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="2"
            stdDeviation="3"
            floodColor="currentColor"
            floodOpacity="0.15"
          />
        </filter>
        <radialGradient id={g1} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.14" />
        </radialGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
        <mask id={mConn}>
          <rect width="96" height="96" fill="white" />
          <circle cx="24" cy="28" r="14" fill="black" />
          <rect x="34" y="38" width="28" height="22" rx="6" fill="black" />
          <circle cx="74" cy="26" r="14" fill="black" />
          <circle cx="24" cy="74" r="11" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${mConn})`}>
        <path
          d="M36 28 Q50 28, 50 42"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M60 50 Q74 50, 74 36"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M50 60 Q50 74, 36 74"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
      </g>

      <circle
        cx="24"
        cy="28"
        r="12"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <circle cx="24" cy="28" r="4" fill="currentColor" fillOpacity={0.35} />

      <rect
        x="36"
        y="40"
        width="24"
        height="18"
        rx="5"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <rect
        x="42"
        y="47.5"
        width="12"
        height="2.5"
        rx="1.25"
        fill="currentColor"
        fillOpacity={0.2}
      />

      <circle
        cx="74"
        cy="26"
        r="12"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <path
        d="M69 26 L73 30 L80 22"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="24"
        cy="74"
        r="9"
        fill="currentColor"
        fillOpacity={0.05}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </svg>
  );
}

/* ── Time Tracking ─────────────────────────────────────────────────── */

export function TimeTrackingIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mHands = `${uid}-mh`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <radialGradient id={g1} cx="42%" cy="38%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </radialGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <mask id={mHands}>
          <rect width="96" height="96" fill="white" />
          <circle cx="42" cy="44" r="4.5" fill="black" />
        </mask>
      </defs>

      <circle
        cx="42"
        cy="44"
        r="26"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.3}
        filter={`url(#${s})`}
      />

      {[0, 90, 180, 270].map(angle => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 42 + Math.sin(rad) * 21;
        const y1 = 44 - Math.cos(rad) * 21;
        const x2 = 42 + Math.sin(rad) * 24;
        const y2 = 44 - Math.cos(rad) * 24;
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}

      <g mask={`url(#${mHands})`}>
        <line
          x1="42"
          y1="44"
          x2="42"
          y2="28"
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <line
          x1="42"
          y1="44"
          x2="56"
          y2="35"
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
      <circle cx="42" cy="44" r="3" fill="currentColor" fillOpacity={0.35} />

      <rect x="74" y="26" width="14" height="5" rx="2.5" fill={`url(#${g2})`} />
      <rect x="74" y="35" width="14" height="5" rx="2.5" fill="currentColor" fillOpacity={0.12} />
      <rect x="74" y="44" width="11" height="5" rx="2.5" fill="currentColor" fillOpacity={0.08} />
      <rect x="74" y="53" width="8" height="5" rx="2.5" fill="currentColor" fillOpacity={0.05} />
    </svg>
  );
}

/* ── Documents (portal) ────────────────────────────────────────────── */

export function DocumentsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mBack = `${uid}-mb`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <mask id={mBack}>
          <rect width="96" height="96" fill="white" />
          <path
            d="M12 38 Q12 34, 16 34 L76 34 Q80 34, 80 38 L80 72 Q80 76, 76 76 L16 76 Q12 76, 12 72 Z"
            fill="black"
          />
        </mask>
      </defs>

      <g mask={`url(#${mBack})`}>
        <rect
          x="30"
          y="12"
          width="28"
          height="26"
          rx="3"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.9}
        />
        <rect x="36" y="20" width="16" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect x="36" y="25" width="12" height="2" rx="1" fill="currentColor" fillOpacity={0.08} />
        <path
          d="M12 28 L12 72 Q12 76, 16 76 L76 76 Q80 76, 80 72 L80 34 Q80 30, 76 30 L46 30 L42 22 Q40 20, 38 20 L16 20 Q12 20, 12 24 Z"
          fill="currentColor"
          fillOpacity={0.1}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={0.8}
        />
      </g>

      <path
        d="M12 38 Q12 34, 16 34 L76 34 Q80 34, 80 38 L80 72 Q80 76, 76 76 L16 76 Q12 76, 12 72 Z"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />

      <circle
        cx="72"
        cy="20"
        r="9"
        fill="currentColor"
        fillOpacity={0.2}
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <text
        x="72"
        y="24.5"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity={0.5}
        fontSize="11"
        fontWeight="700"
        fontFamily="inherit">
        0
      </text>
    </svg>
  );
}

/* ── Notifications ─────────────────────────────────────────────────── */

export function NotificationsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const mBell = `${uid}-mb`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </linearGradient>
        <mask id={mBell}>
          <rect width="96" height="96" fill="white" />
          <circle cx="48" cy="17" r="5" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${mBell})`} filter={`url(#${s})`}>
        <path
          d="M32 42 Q32 24, 48 19 Q64 24, 64 42 L64 56 L70 62 L26 62 L32 56 Z"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      </g>

      <path
        d="M40 62 Q40 72, 48 72 Q56 72, 56 62"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1.5}
      />
      <circle
        cx="48"
        cy="17"
        r="3"
        fill="currentColor"
        fillOpacity={0.25}
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={1}
      />

      <path
        d="M74 26 L76 21 L78 26 L83 28 L78 30 L76 35 L74 30 L69 28 Z"
        fill="currentColor"
        fillOpacity={0.15}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={0.7}
      />
      <path
        d="M18 36 L19.5 33 L21 36 L24 37.5 L21 39 L19.5 42 L18 39 L15 37.5 Z"
        fill="currentColor"
        fillOpacity={0.1}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.5}
      />
    </svg>
  );
}

/* ── Reports: Spend ────────────────────────────────────────────────── */

export function SpendReportIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="2"
            stdDeviation="3"
            floodColor="currentColor"
            floodOpacity="0.15"
          />
        </filter>
        <linearGradient id={g1} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id={g2} cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </radialGradient>
      </defs>

      <rect
        x="14"
        y="14"
        width="62"
        height="58"
        rx="5"
        fill="currentColor"
        fillOpacity={0.05}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={0.8}
      />
      <line
        x1="22"
        y1="28"
        x2="68"
        y2="28"
        stroke="currentColor"
        strokeOpacity={0.04}
        strokeWidth={0.6}
      />
      <line
        x1="22"
        y1="42"
        x2="68"
        y2="42"
        stroke="currentColor"
        strokeOpacity={0.04}
        strokeWidth={0.6}
      />
      <line
        x1="22"
        y1="56"
        x2="68"
        y2="56"
        stroke="currentColor"
        strokeOpacity={0.04}
        strokeWidth={0.6}
      />

      <rect
        x="24"
        y="36"
        width="9"
        height="28"
        rx="2"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={0.8}
        filter={`url(#${s})`}
      />
      <rect
        x="37"
        y="22"
        width="9"
        height="42"
        rx="2"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={0.8}
        filter={`url(#${s})`}
      />
      <rect
        x="50"
        y="30"
        width="9"
        height="34"
        rx="2"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={0.8}
        filter={`url(#${s})`}
      />
      <rect
        x="63"
        y="44"
        width="9"
        height="20"
        rx="2"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={0.8}
      />
      <line
        x1="20"
        y1="64"
        x2="74"
        y2="64"
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />

      <circle
        cx="82"
        cy="20"
        r="9"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <text
        x="82"
        y="24.5"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity={0.55}
        fontSize="11"
        fontWeight="700"
        fontFamily="inherit">
        $
      </text>
    </svg>
  );
}

/* ── Reports: Expiring Contracts ───────────────────────────────────── */

export function ExpiringContractsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mDoc = `${uid}-md`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={g2} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
        <mask id={mDoc}>
          <rect width="96" height="96" fill="white" />
          <path d="M66 29 L83 53 L49 53 Z" fill="black" />
        </mask>
      </defs>

      <ellipse cx="40" cy="82" rx="26" ry="4" fill="currentColor" fillOpacity={0.06} />

      <g mask={`url(#${mDoc})`} filter={`url(#${s})`}>
        <rect
          x="16"
          y="10"
          width="46"
          height="68"
          rx="5"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1.2}
        />
        <rect x="24" y="22" width="28" height="2" rx="1" fill="currentColor" fillOpacity={0.15} />
        <rect x="24" y="28" width="22" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />
        <rect x="24" y="34" width="24" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />
        <rect x="24" y="46" width="28" height="2" rx="1" fill="currentColor" fillOpacity={0.07} />
        <rect x="24" y="52" width="20" height="2" rx="1" fill="currentColor" fillOpacity={0.06} />
        <rect x="24" y="62" width="24" height="2" rx="1" fill="currentColor" fillOpacity={0.05} />
      </g>

      <path
        d="M66 30 L82 52 L50 52 Z"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.3}
        strokeLinejoin="round"
        filter={`url(#${s})`}
      />
      <line
        x1="66"
        y1="37"
        x2="66"
        y2="46"
        stroke="currentColor"
        strokeOpacity={0.6}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <circle cx="66" cy="49" r="1" fill="currentColor" fillOpacity={0.5} />
    </svg>
  );
}

/* ── Reports: Overdue Invoices ─────────────────────────────────────── */

export function OverdueInvoicesIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mInv = `${uid}-mi`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id={g2} cx="45%" cy="40%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </radialGradient>
        <mask id={mInv}>
          <rect width="96" height="96" fill="white" />
          <circle cx="72" cy="60" r="19" fill="black" />
        </mask>
      </defs>

      <ellipse cx="38" cy="80" rx="26" ry="4" fill="currentColor" fillOpacity={0.06} />

      <g mask={`url(#${mInv})`} filter={`url(#${s})`}>
        <rect
          x="14"
          y="14"
          width="44"
          height="62"
          rx="5"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={1.2}
        />
        <rect
          x="22"
          y="26"
          width="20"
          height="2.5"
          rx="1.25"
          fill="currentColor"
          fillOpacity={0.2}
        />
        <rect x="22" y="32" width="28" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect x="22" y="38" width="24" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect
          x="22"
          y="48"
          width="28"
          height="0.8"
          rx="0.4"
          fill="currentColor"
          fillOpacity={0.06}
        />
        <rect x="34" y="56" width="16" height="3" rx="1.5" fill="currentColor" fillOpacity={0.18} />
      </g>

      <circle
        cx="72"
        cy="60"
        r="17"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.3}
        filter={`url(#${s})`}
      />
      <line
        x1="72"
        y1="60"
        x2="72"
        y2="49"
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <line
        x1="72"
        y1="60"
        x2="80"
        y2="55"
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      <circle cx="72" cy="60" r="2" fill="currentColor" fillOpacity={0.35} />
    </svg>
  );
}

/* ── Reports: Compliance Gaps ──────────────────────────────────────── */

export function ComplianceGapsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <path
        d="M48 10 L76 22 L76 50 Q76 72, 48 84 Q20 72, 20 50 L20 22 Z"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.28}
        strokeWidth={1.3}
        strokeLinejoin="round"
        filter={`url(#${s})`}
      />
      <path
        d="M48 18 L68 27 L68 48 Q68 65, 48 75 Q28 65, 28 48 L28 27 Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.7}
        strokeLinejoin="round"
      />

      <line
        x1="48"
        y1="32"
        x2="48"
        y2="52"
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx="48" cy="60" r="2.5" fill="currentColor" fillOpacity={0.4} />
    </svg>
  );
}

/* ── Integrations / Connect ────────────────────────────────────────── */

export function IntegrationsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const mLine = `${uid}-ml`;
  const mLeft = `${uid}-mlt`;
  const mRight = `${uid}-mrt`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <radialGradient id={g1} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </radialGradient>
        <mask id={mLine}>
          <rect width="96" height="96" fill="white" />
          <rect x="8" y="26" width="42" height="44" rx="10" fill="black" />
          <rect x="46" y="26" width="42" height="44" rx="10" fill="black" />
          <circle cx="48" cy="48" r="7" fill="black" />
        </mask>
        <mask id={mLeft}>
          <rect width="96" height="96" fill="white" />
          <circle cx="48" cy="48" r="7" fill="black" />
        </mask>
        <mask id={mRight}>
          <rect width="96" height="96" fill="white" />
          <circle cx="48" cy="48" r="7" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${mLine})`}>
        <line
          x1="20"
          y1="48"
          x2="76"
          y2="48"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
      </g>

      <g mask={`url(#${mLeft})`} filter={`url(#${s})`}>
        <rect
          x="10"
          y="28"
          width="38"
          height="40"
          rx="8"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1.2}
        />
        <rect
          x="18"
          y="42"
          width="22"
          height="2.5"
          rx="1.25"
          fill="currentColor"
          fillOpacity={0.2}
        />
        <rect
          x="18"
          y="48"
          width="16"
          height="2.5"
          rx="1.25"
          fill="currentColor"
          fillOpacity={0.12}
        />
      </g>

      <g mask={`url(#${mRight})`} filter={`url(#${s})`}>
        <rect
          x="48"
          y="28"
          width="38"
          height="40"
          rx="8"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.22}
          strokeWidth={1.2}
        />
        <circle
          cx="67"
          cy="48"
          r="8"
          fill="currentColor"
          fillOpacity={0.08}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={0.7}
        />
        <line
          x1="63"
          y1="48"
          x2="71"
          y2="48"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <line
          x1="67"
          y1="44"
          x2="67"
          y2="52"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </g>

      <circle
        cx="48"
        cy="48"
        r="5"
        fill="currentColor"
        fillOpacity={0.2}
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1}
      />
      <circle cx="48" cy="48" r="1.8" fill="currentColor" fillOpacity={0.35} />
    </svg>
  );
}

/* ── Teams / Members ───────────────────────────────────────────────── */

export function TeamsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mSide = `${uid}-ms`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <radialGradient id={g1} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id={g2} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.06" />
        </radialGradient>
        <mask id={mSide}>
          <rect width="96" height="96" fill="white" />
          <circle cx="48" cy="30" r="14" fill="black" />
          <path d="M32 76 C32 53, 40 43, 48 43 C56 43, 64 53, 64 76 L32 76" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${mSide})`}>
        <circle
          cx="26"
          cy="36"
          r="9"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.9}
        />
        <path
          d="M14 72 C14 57, 20 49, 26 49 C32 49, 38 57, 38 72"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
        <circle
          cx="70"
          cy="36"
          r="9"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={0.9}
        />
        <path
          d="M58 72 C58 57, 64 49, 70 49 C76 49, 82 57, 82 72"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
      </g>

      <circle
        cx="48"
        cy="30"
        r="12"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <path
        d="M34 72 C34 55, 41 45, 48 45 C55 45, 62 55, 62 72"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1.2}
        strokeLinecap="round"
        filter={`url(#${s})`}
      />
    </svg>
  );
}

/* ── Audit Log / History ───────────────────────────────────────────── */

export function AuditLogIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mSpine = `${uid}-ms`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="2"
            stdDeviation="3"
            floodColor="currentColor"
            floodOpacity="0.15"
          />
        </filter>
        <radialGradient id={g1} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </radialGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <mask id={mSpine}>
          <rect width="96" height="96" fill="white" />
          <circle cx="28" cy="24" r="7" fill="black" />
          <circle cx="28" cy="48" r="8" fill="black" />
          <circle cx="28" cy="72" r="6" fill="black" />
          <rect x="38" y="15" width="42" height="18" rx="5" fill="black" />
          <rect x="38" y="37" width="46" height="22" rx="5" fill="black" />
          <rect x="38" y="64" width="38" height="16" rx="4" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${mSpine})`}>
        <line
          x1="28"
          y1="14"
          x2="28"
          y2="82"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1.5}
        />
      </g>

      <circle
        cx="28"
        cy="24"
        r="5"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <rect
        x="40"
        y="17"
        width="38"
        height="14"
        rx="3.5"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={0.8}
        filter={`url(#${s})`}
      />
      <rect x="44" y="22" width="24" height="2" rx="1" fill="currentColor" fillOpacity={0.15} />

      <circle
        cx="28"
        cy="48"
        r="6.5"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={1.2}
        filter={`url(#${s})`}
      />
      <circle cx="28" cy="48" r="2.5" fill="currentColor" fillOpacity={0.3} />
      <rect
        x="40"
        y="39"
        width="42"
        height="18"
        rx="4"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <rect x="44" y="45" width="20" height="2.5" rx="1.25" fill="currentColor" fillOpacity={0.2} />
      <rect x="44" y="51" width="30" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />

      <circle
        cx="28"
        cy="72"
        r="4.5"
        fill="currentColor"
        fillOpacity={0.1}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={0.8}
      />
      <rect
        x="40"
        y="66"
        width="34"
        height="12"
        rx="3"
        fill="currentColor"
        fillOpacity={0.06}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={0.7}
      />
      <rect x="44" y="70.5" width="20" height="2" rx="1" fill="currentColor" fillOpacity={0.06} />
    </svg>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────── */

export function DashboardIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mGrid = `${uid}-mg`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="2"
            stdDeviation="3"
            floodColor="currentColor"
            floodOpacity="0.15"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id={g2} cx="45%" cy="35%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
        </radialGradient>
        <mask id={mGrid}>
          <rect width="96" height="96" fill="white" />
          <rect x="8" y="10" width="38" height="24" rx="5" fill="black" />
          <rect x="50" y="10" width="38" height="24" rx="5" fill="black" />
          <rect x="8" y="38" width="26" height="20" rx="5" fill="black" />
          <rect x="38" y="38" width="50" height="20" rx="5" fill="black" />
          <rect x="8" y="62" width="80" height="18" rx="5" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${mGrid})`}>
        <line
          x1="48"
          y1="6"
          x2="48"
          y2="84"
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={0.8}
        />
        <line
          x1="4"
          y1="36"
          x2="92"
          y2="36"
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={0.8}
        />
        <line
          x1="4"
          y1="60"
          x2="92"
          y2="60"
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={0.8}
        />
      </g>

      <rect
        x="8"
        y="10"
        width="38"
        height="24"
        rx="5"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <rect x="14" y="16" width="16" height="3" rx="1.5" fill="currentColor" fillOpacity={0.2} />
      <rect x="14" y="24" width="24" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />

      <rect
        x="50"
        y="10"
        width="38"
        height="24"
        rx="5"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <rect x="56" y="16" width="14" height="3" rx="1.5" fill="currentColor" fillOpacity={0.2} />
      <rect x="56" y="24" width="22" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />

      <rect
        x="8"
        y="38"
        width="26"
        height="20"
        rx="5"
        fill={`url(#${g2})`}
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <circle
        cx="21"
        cy="48"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1.5}
      />

      <rect
        x="38"
        y="38"
        width="50"
        height="20"
        rx="5"
        fill={`url(#${g1})`}
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={1}
        filter={`url(#${s})`}
      />
      <rect x="44" y="44" width="18" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
      <rect x="44" y="50" width="30" height="2" rx="1" fill="currentColor" fillOpacity={0.08} />

      <rect
        x="8"
        y="62"
        width="80"
        height="18"
        rx="5"
        fill="currentColor"
        fillOpacity={0.08}
        stroke="currentColor"
        strokeOpacity={0.12}
        strokeWidth={0.8}
      />
      <rect x="14" y="68" width="28" height="2.5" rx="1.25" fill="currentColor" fillOpacity={0.1} />
      <rect x="14" y="73" width="20" height="2" rx="1" fill="currentColor" fillOpacity={0.06} />
    </svg>
  );
}

/* ── My Tasks ─────────────────────────────────────────────────────── */
/**
 * Two masked-face avatar coins stacked over a checklist card. Conveys
 * "tasks assigned to people" with a playful identity-anonymised motif
 * (matches the user-requested "masked faces" sketch).
 */
export function MyTasksIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const g3 = `${uid}-c`;
  const mCard = `${uid}-mc`;
  const mFront = `${uid}-mf`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id={g3} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
        </linearGradient>
        <mask id={mCard}>
          <rect width="96" height="96" fill="white" />
          <circle cx="60" cy="56" r="18" fill="black" />
          <circle cx="32" cy="62" r="14" fill="black" />
        </mask>
        <mask id={mFront}>
          <rect width="96" height="96" fill="white" />
          <circle cx="32" cy="62" r="14" fill="black" />
        </mask>
      </defs>

      <ellipse cx="48" cy="84" rx="30" ry="4" fill="currentColor" fillOpacity={0.06} />

      {/* Checklist card behind the avatars */}
      <g mask={`url(#${mCard})`}>
        <rect
          x="12"
          y="14"
          width="72"
          height="52"
          rx="6"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={1}
          filter={`url(#${s})`}
        />
        {/* Checkbox + line rows */}
        <rect x="20" y="22" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity={0.22} />
        <path
          d="M21.5 25 L23 26.5 L25 24"
          stroke="currentColor"
          strokeOpacity={0.55}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="30" y="23" width="34" height="3" rx="1.5" fill="currentColor" fillOpacity={0.18} />
        <rect
          x="20"
          y="34"
          width="6"
          height="6"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.32}
          strokeWidth={1}
        />
        <rect x="30" y="35" width="42" height="3" rx="1.5" fill="currentColor" fillOpacity={0.16} />
        <rect
          x="20"
          y="46"
          width="6"
          height="6"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.32}
          strokeWidth={1}
        />
        <rect x="30" y="47" width="28" height="3" rx="1.5" fill="currentColor" fillOpacity={0.16} />
      </g>

      {/* Back avatar */}
      <g mask={`url(#${mFront})`} filter={`url(#${s})`}>
        <circle
          cx="60"
          cy="56"
          r="16"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1.2}
        />
        {/* Domino-style mask across the eyes */}
        <path
          d="M50 53 Q60 49 70 53 Q67 60 60 60 Q53 60 50 53 Z"
          fill="currentColor"
          fillOpacity={0.55}
        />
        <circle cx="56" cy="55" r="1.2" fill="currentColor" fillOpacity={0.85} />
        <circle cx="64" cy="55" r="1.2" fill="currentColor" fillOpacity={0.85} />
        {/* Smile */}
        <path
          d="M55 64 Q60 67 65 64"
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* Front avatar */}
      <g filter={`url(#${s})`}>
        <circle
          cx="32"
          cy="62"
          r="13"
          fill={`url(#${g3})`}
          stroke="currentColor"
          strokeOpacity={0.36}
          strokeWidth={1.2}
        />
        <path
          d="M24 60 Q32 56 40 60 Q38 66 32 66 Q26 66 24 60 Z"
          fill="currentColor"
          fillOpacity={0.6}
        />
        <circle cx="29" cy="61" r="1.2" fill="currentColor" fillOpacity={0.9} />
        <circle cx="35" cy="61" r="1.2" fill="currentColor" fillOpacity={0.9} />
        <path
          d="M28 68 Q32 70 36 68"
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/* ── Templates ────────────────────────────────────────────────────── */
/**
 * Stacked blueprint sheets — front sheet shows a faint grid + filled
 * heading, conveying "reusable template document".
 */
export function TemplatesIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mBack2 = `${uid}-m2`;
  const mBack1 = `${uid}-m1`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.36" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </linearGradient>
        <mask id={mBack2}>
          <rect width="96" height="96" fill="white" />
          <rect x="22" y="20" width="46" height="60" rx="4" fill="black" />
        </mask>
        <mask id={mBack1}>
          <rect width="96" height="96" fill="white" />
          <rect x="18" y="16" width="46" height="60" rx="4" fill="black" />
        </mask>
      </defs>

      <ellipse cx="48" cy="84" rx="28" ry="3.5" fill="currentColor" fillOpacity={0.06} />

      {/* Sheet 3 (bottom) */}
      <g mask={`url(#${mBack2})`}>
        <rect
          x="26"
          y="12"
          width="46"
          height="60"
          rx="4"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      </g>

      {/* Sheet 2 (middle) */}
      <g mask={`url(#${mBack1})`}>
        <rect
          x="22"
          y="16"
          width="46"
          height="60"
          rx="4"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.22}
          strokeWidth={1}
        />
      </g>

      {/* Sheet 1 (front) */}
      <g filter={`url(#${s})`}>
        <rect
          x="18"
          y="20"
          width="46"
          height="60"
          rx="4"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.32}
          strokeWidth={1.2}
        />
        {/* Title block */}
        <rect x="24" y="28" width="22" height="3" rx="1.5" fill="currentColor" fillOpacity={0.34} />
        <rect x="24" y="34" width="34" height="2" rx="1" fill="currentColor" fillOpacity={0.16} />
        {/* Grid lines */}
        <line
          x1="24"
          y1="44"
          x2="58"
          y2="44"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        <line
          x1="24"
          y1="52"
          x2="58"
          y2="52"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        <line
          x1="24"
          y1="60"
          x2="58"
          y2="60"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        <line
          x1="32"
          y1="40"
          x2="32"
          y2="68"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        <line
          x1="44"
          y1="40"
          x2="44"
          y2="68"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        {/* Filled cells */}
        <rect x="25" y="45" width="6" height="6" rx="1" fill="currentColor" fillOpacity={0.18} />
        <rect x="37" y="53" width="6" height="6" rx="1" fill="currentColor" fillOpacity={0.14} />
      </g>
    </svg>
  );
}

/* ── No Results ───────────────────────────────────────────────────── */
/**
 * Magnifying glass over an empty page with a faint sparkle. Replaces
 * the generic Search/SearchX lucide icon used for filter-empty states.
 */
export function NoResultsIllustration({ className, ...rest }: IllustrationProps) {
  const uid = useId();
  const s = `${uid}-s`;
  const g1 = `${uid}-a`;
  const g2 = `${uid}-b`;
  const mPage = `${uid}-mp`;

  return (
    <svg {...DEFAULTS} viewBox="0 0 96 96" className={className} {...rest}>
      <defs>
        <filter id={s} x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="4"
            floodColor="currentColor"
            floodOpacity="0.18"
          />
        </filter>
        <linearGradient id={g1} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={g2} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.36" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.18" />
        </linearGradient>
        <mask id={mPage}>
          <rect width="96" height="96" fill="white" />
          <circle cx="60" cy="56" r="22" fill="black" />
        </mask>
      </defs>

      <ellipse cx="48" cy="84" rx="28" ry="3.5" fill="currentColor" fillOpacity={0.06} />

      {/* Empty page behind */}
      <g mask={`url(#${mPage})`}>
        <rect
          x="14"
          y="14"
          width="46"
          height="60"
          rx="4"
          fill={`url(#${g1})`}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
        <rect x="20" y="22" width="22" height="3" rx="1.5" fill="currentColor" fillOpacity={0.2} />
        <rect x="20" y="30" width="34" height="2" rx="1" fill="currentColor" fillOpacity={0.12} />
        <rect x="20" y="38" width="30" height="2" rx="1" fill="currentColor" fillOpacity={0.1} />
      </g>

      {/* Sparkle accent */}
      <g fill="currentColor" fillOpacity={0.5}>
        <path d="M22 56 L23 58 L25 59 L23 60 L22 62 L21 60 L19 59 L21 58 Z" />
      </g>

      {/* Magnifying glass */}
      <g filter={`url(#${s})`}>
        <circle
          cx="60"
          cy="56"
          r="18"
          fill={`url(#${g2})`}
          stroke="currentColor"
          strokeOpacity={0.36}
          strokeWidth={1.5}
        />
        <circle
          cx="60"
          cy="56"
          r="12"
          fill="currentColor"
          fillOpacity={0.05}
          stroke="currentColor"
          strokeOpacity={0.22}
          strokeWidth={1}
        />
        {/* Handle */}
        <rect
          x="72"
          y="68"
          width="14"
          height="5"
          rx="2.5"
          transform="rotate(45 72 68)"
          fill="currentColor"
          fillOpacity={0.42}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={0.8}
        />
      </g>
    </svg>
  );
}
