"use client";

import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Minus, Plus } from "lucide-react";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/* ── Button ─────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "plain";
type ButtonSize = "lg" | "md" | "sm";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: ReactNode }>(
  function Button({ variant = "primary", size = "md", block, icon, className, children, ...rest }, ref) {
    return (
      <motion.button
        ref={ref}
        whileTap={rest.disabled ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
        className={cx(
          "inline-flex select-none items-center justify-center gap-2 font-medium transition-colors disabled:opacity-40",
          size === "lg" && "h-14 rounded-2xl px-6 text-[17px] tracking-[-0.01em]",
          size === "md" && "h-11 rounded-xl px-4 text-[15px]",
          size === "sm" && "h-8 rounded-lg px-3 text-[13px]",
          variant === "primary" && "bg-accent text-accent-ink hover:brightness-105",
          variant === "secondary" && "bg-surface-2 text-text hover:bg-surface-3",
          variant === "ghost" && "text-accent hover:bg-accent-soft",
          variant === "plain" && "text-text-2 hover:text-text",
          variant === "danger" && "bg-critical-soft text-critical",
          block && "w-full",
          className,
        )}
        {...(rest as object)}
      >
        {icon}
        {children}
      </motion.button>
    );
  },
);

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx("grid h-10 w-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-2 hover:text-text", className)} {...rest}>
      {children}
    </button>
  );
}

/* ── Surfaces ───────────────────────────────────────────────────── */

export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <As className={cx("rounded-[var(--radius-card)] bg-surface", className)} {...rest}>
      {children}
    </As>
  );
}

export function Section({ title, action, children, className, subtitle }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("space-y-3", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            {title && <h2 className="text-headline">{title}</h2>}
            {subtitle && <p className="text-caption text-text-3">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx("h-px bg-line", className)} />;
}

/* ── Pills / badges ─────────────────────────────────────────────── */

export type Tone = "neutral" | "accent" | "positive" | "caution" | "critical";

export function Pill({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium",
        tone === "neutral" && "bg-surface-2 text-text-2",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "positive" && "bg-positive-soft text-positive",
        tone === "caution" && "bg-caution-soft text-caution",
        tone === "critical" && "bg-critical-soft text-critical",
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function BasisTag({ basis }: { basis: "measured" | "estimate" | "self-reported" | "rule" | "data" | "uncertain" | "demo" }) {
  const map = {
    measured: ["Measured", "neutral"],
    estimate: ["Estimate", "accent"],
    "self-reported": ["Self-reported", "neutral"],
    rule: ["Coaching rule", "neutral"],
    data: ["From your logs", "positive"],
    uncertain: ["Limited data", "caution"],
    demo: ["Demo", "caution"],
  } as const;
  const [label, tone] = map[basis];
  return <Pill tone={tone as Tone}>{label}</Pill>;
}

/* ── Segmented control ──────────────────────────────────────────── */

export function Segmented<T extends string | number>({ options, value, onChange, className, size = "md" }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; size?: "md" | "sm" }) {
  return (
    <div role="radiogroup" className={cx("relative flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx("relative z-10 flex-1 rounded-lg font-medium transition-colors", size === "md" ? "h-9 text-[14px]" : "h-7 text-[12px]", active ? "text-text" : "text-text-2 hover:text-text")}
          >
            {active && <motion.span layoutId={`seg-${options.map((x) => x.value).join("-")}`} className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.08)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Choice tile / chip ─────────────────────────────────────────── */

export function Chip({ selected, onClick, children, className }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors",
        selected ? "border-transparent bg-text text-bg" : "border-line-strong bg-transparent text-text hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export function ChoiceTile({ selected, onClick, title, detail, icon, badge, className }: { selected?: boolean; onClick?: () => void; title: ReactNode; detail?: ReactNode; icon?: ReactNode; badge?: ReactNode; className?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "relative flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
        selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
        className,
      )}
    >
      {icon && <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", selected ? "bg-accent text-accent-ink" : "bg-surface-2 text-text-2")}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        {detail && <span className="mt-0.5 block text-caption text-text-2">{detail}</span>}
      </span>
      {badge}
    </motion.button>
  );
}

/* ── Stepper (weight / reps) ────────────────────────────────────── */

export function Stepper({ value, onChange, step, min = 0, max = 9999, label, unit, size = "lg", format }: { value: number; onChange: (v: number) => void; step: number; min?: number; max?: number; label: string; unit?: string; size?: "lg" | "md"; format?: (v: number) => string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = parseFloat(draft.replace(",", "."));
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setEditing(false);
  };
  const btn = cx("grid shrink-0 place-items-center rounded-full bg-surface-2 text-text transition-colors hover:bg-surface-3 active:scale-95", size === "lg" ? "h-11 w-11" : "h-9 w-9");
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-micro text-text-3">{label}</span>
      <div className="flex items-center gap-2">
        <button aria-label={`Decrease ${label}`} className={btn} onClick={() => onChange(Math.max(min, Math.round((value - step) * 1000) / 1000))}>
          <Minus size={18} />
        </button>
        {editing ? (
          <input
            autoFocus
            inputMode="decimal"
            type="number"
            aria-label={label}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className={cx("tnum w-16 rounded-lg bg-surface-2 text-center font-semibold outline-none", size === "lg" ? "h-11 text-[26px]" : "h-9 text-[20px]")}
          />
        ) : (
          <button
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            className={cx("tnum text-center font-semibold tracking-tight", size === "lg" ? "min-w-[4rem] text-[32px] leading-none" : "min-w-[3.25rem] text-[22px] leading-none")}
            aria-label={`${label}: ${value}${unit ? " " + unit : ""}. Tap to type.`}
          >
            <AnimatedNumber value={value} format={format} />
            {unit && <span className="ml-1 text-[13px] font-medium text-text-3">{unit}</span>}
          </button>
        )}
        <button aria-label={`Increase ${label}`} className={btn} onClick={() => onChange(Math.min(max, Math.round((value + step) * 1000) / 1000))}>
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

/* ── Numbers & progress ─────────────────────────────────────────── */

export function AnimatedNumber({ value, format, className }: { value: number; format?: (v: number) => string; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => (format ? format(v) : formatSmart(v, value)));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={cx("tnum", className)}>{text}</motion.span>;
}

function formatSmart(v: number, target: number) {
  const decimals = Number.isInteger(target) ? 0 : (String(target).split(".")[1]?.length ?? 1);
  return v.toFixed(Math.min(2, decimals));
}

export function Ring({ value, size = 64, stroke = 6, tone = "accent", children, track = true }: { value: number; size?: number; stroke?: number; tone?: Tone; children?: ReactNode; track?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = tone === "positive" ? "var(--positive)" : tone === "caution" ? "var(--caution)" : tone === "critical" ? "var(--critical)" : tone === "neutral" ? "var(--text-3)" : "var(--accent)";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {track && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function Meter({ value, tone = "accent", className, height = 6 }: { value: number; tone?: Tone; className?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  const color = tone === "positive" ? "bg-positive" : tone === "caution" ? "bg-caution" : tone === "critical" ? "bg-critical" : tone === "neutral" ? "bg-text-3" : "bg-accent";
  return (
    <div className={cx("overflow-hidden rounded-full bg-surface-3", className)} style={{ height }}>
      <motion.div className={cx("h-full rounded-full", color)} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  );
}

export function Stat({ label, value, unit, hint, className }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="text-caption text-text-3">{label}</div>
      <div className="tnum mt-0.5 text-[22px] font-semibold leading-tight tracking-tight">
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-text-3">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-caption text-text-2">{hint}</div>}
    </div>
  );
}

/* ── Rows & empty states ────────────────────────────────────────── */

export function Row({ title, detail, leading, trailing, onClick, className }: { title: ReactNode; detail?: ReactNode; leading?: ReactNode; trailing?: ReactNode; onClick?: () => void; className?: string }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left", onClick && "transition-colors hover:bg-surface-2 active:bg-surface-2", className)}>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{title}</div>
        {detail && <div className="mt-0.5 text-caption text-text-2">{detail}</div>}
      </div>
      {trailing}
    </C>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-text-2">{icon}</div>}
      <div className="text-headline">{title}</div>
      <p className="mt-1 max-w-xs text-body text-text-2">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-2xl bg-surface-2", className)} />;
}

/* ── Sparkline ──────────────────────────────────────────────────── */

export function Sparkline({ values, width = 120, height = 36, tone = "accent", className, fill = true }: { values: number[]; width?: number; height?: number; tone?: Tone; className?: string; fill?: boolean }) {
  if (values.length < 2) return <div style={{ width, height }} className={className} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const color = tone === "positive" ? "var(--positive)" : tone === "caution" ? "var(--caution)" : tone === "neutral" ? "var(--text-3)" : "var(--accent)";
  const id = `sg-${Math.round(values[0] * 100)}-${values.length}-${tone}`;
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`} fill={`url(#${id})`} />}
      <motion.path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: "easeOut" }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill={color} />
    </svg>
  );
}

/* ── Toggle switch ──────────────────────────────────────────────── */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-positive" : "bg-surface-3")}>
      <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 35 }} className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow", checked ? "right-0.5" : "left-0.5")} />
    </button>
  );
}
