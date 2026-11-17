/**
 * Original inline icons.
 *
 * SF Symbols may not be redistributed on the web, so these are drawn here in
 * a Lucide-like idiom: 24×24 grid, 1.75 stroke, round caps and joins. Inline
 * SVG keeps them themeable and adds no dependency.
 */
interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className,
  };
}

export function CheckIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

export function PlusIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

/** A turn back to the start: the body's "reset view" (block 7B). */
export function ResetIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4.5 4.5v4h4" />
    </svg>
  );
}

export function InfoIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function CloseIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/* Solid bars rather than two strokes: at 18px a stroked pause reads as a
   pair of hairlines next to the filled icons beside it. */
export function PauseIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="8.25" y="5" width="3" height="14" rx="1.5" fill="currentColor" stroke="none" />
      <rect x="12.75" y="5" width="3" height="14" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlayIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M8 5.5 18 12 8 18.5z" />
    </svg>
  );
}

export function ArchiveIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 7.5h16M5.5 7.5V18a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V7.5" />
      <path d="M4 4.5h16v3H4zM10 12h4" />
    </svg>
  );
}

/** Today: a filled dot inside a ring — the day you are standing in. */
export function TodayIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="2.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Progress: a rising line. */
export function ProgressIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 16.5 9 11l3.5 3.5L20 6.5" />
      <path d="M20 6.5h-4.5M20 6.5V11" />
    </svg>
  );
}

/** Rank: a shield. The only navigation icon that hints at the badges. */
export function RankIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3.5 19 6v5.5c0 4-2.9 7.4-7 8.9-4.1-1.5-7-4.9-7-8.9V6z" />
    </svg>
  );
}

/** Areas: separate fields of life. */
export function AreasIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
    </svg>
  );
}

/** Sports: a stride. Deliberately not the shield — that belongs to Rank. */
export function ActivityIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="14.5" cy="5" r="1.9" />
      <path d="M8 20.5l2.2-5 3.3-2.2-1-4.3-3.6 2.3-1.4 3" />
      <path d="M13.5 13.3 16 16.4l3 .9" />
    </svg>
  );
}

export function SparkIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 4.5 13.8 9.6 19 11.4l-5.2 1.8L12 18.3l-1.8-5.1L5 11.4l5.2-1.8z" />
    </svg>
  );
}

/** Mind: a check in a circle — the day's check-in. */
export function MindIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M8.4 12.3 11 14.9l4.8-5.3" />
    </svg>
  );
}

/** Gym: a barbell, seen from the front. */
export function GymIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 12h6M2.8 10.2v3.6M21.2 10.2v3.6" />
      <rect x="5.5" y="7" width="3.5" height="10" rx="1.5" />
      <rect x="15" y="7" width="3.5" height="10" rx="1.5" />
    </svg>
  );
}

/** A closed lock: what stays on the device. */
export function LockIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.6" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
    </svg>
  );
}

/** A rise: up and to the right. */
export function TrendUpIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 18 18 6M9.5 6H18v8.5" />
    </svg>
  );
}
