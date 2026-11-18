"use client";

import { motion } from "motion/react";
import type { Muscle } from "@/lib/types";
import { MUSCLE_LABEL } from "@/lib/format";

/**
 * Stylised anatomical map (front and back). Regions are tappable buttons with
 * accessible labels; colour is supplied by the caller so the same map shows
 * soreness, strength levels or training volume.
 */

type Shape = { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; rot?: number } | { kind: "path"; d: string };

const mirror = (s: Shape): Shape => (s.kind === "ellipse" ? { ...s, cx: 200 - s.cx, rot: s.rot ? -s.rot : undefined } : { kind: "path", d: mirrorPath(s.d) });

function mirrorPath(d: string): string {
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - Number(x)} ${y}`);
}

const PEC: Shape = { kind: "path", d: "M99 84 C 88 79 74 81 70 92 C 68 104 78 113 99 111 Z" };
const FRONT: Partial<Record<Muscle, Shape[]>> = {
  shoulders: [{ kind: "ellipse", cx: 63, cy: 92, rx: 13, ry: 12 }, mirror({ kind: "ellipse", cx: 63, cy: 92, rx: 13, ry: 12 })],
  chest: [PEC, mirror(PEC)],
  biceps: [{ kind: "ellipse", cx: 57, cy: 128, rx: 8.5, ry: 19, rot: 8 }, mirror({ kind: "ellipse", cx: 57, cy: 128, rx: 8.5, ry: 19, rot: 8 })],
  forearms: [{ kind: "ellipse", cx: 49, cy: 174, rx: 7.5, ry: 21, rot: 10 }, mirror({ kind: "ellipse", cx: 49, cy: 174, rx: 7.5, ry: 21, rot: 10 })],
  core: [{ kind: "path", d: "M86 116 L114 116 Q118 150 113 186 L87 186 Q82 150 86 116 Z" }],
  quads: [{ kind: "ellipse", cx: 85, cy: 243, rx: 14, ry: 40, rot: 3 }, mirror({ kind: "ellipse", cx: 85, cy: 243, rx: 14, ry: 40, rot: 3 })],
  calves: [{ kind: "ellipse", cx: 85, cy: 322, rx: 8, ry: 24 }, mirror({ kind: "ellipse", cx: 85, cy: 322, rx: 8, ry: 24 })],
};

const LAT: Shape = { kind: "path", d: "M99 76 L 82 80 L 70 96 L 75 138 L 99 160 Z" };
const BACK: Partial<Record<Muscle, Shape[]>> = {
  shoulders: [{ kind: "ellipse", cx: 63, cy: 92, rx: 13, ry: 12 }, mirror({ kind: "ellipse", cx: 63, cy: 92, rx: 13, ry: 12 })],
  back: [LAT, mirror(LAT)],
  triceps: [{ kind: "ellipse", cx: 57, cy: 128, rx: 8.5, ry: 19, rot: 8 }, mirror({ kind: "ellipse", cx: 57, cy: 128, rx: 8.5, ry: 19, rot: 8 })],
  forearms: [{ kind: "ellipse", cx: 49, cy: 174, rx: 7.5, ry: 21, rot: 10 }, mirror({ kind: "ellipse", cx: 49, cy: 174, rx: 7.5, ry: 21, rot: 10 })],
  core: [{ kind: "path", d: "M88 164 L112 164 L114 186 L86 186 Z" }],
  glutes: [{ kind: "ellipse", cx: 88, cy: 202, rx: 13, ry: 14 }, mirror({ kind: "ellipse", cx: 88, cy: 202, rx: 13, ry: 14 })],
  hamstrings: [{ kind: "ellipse", cx: 86, cy: 255, rx: 12, ry: 33, rot: 3 }, mirror({ kind: "ellipse", cx: 86, cy: 255, rx: 12, ry: 33, rot: 3 })],
  calves: [{ kind: "ellipse", cx: 85, cy: 322, rx: 10, ry: 24 }, mirror({ kind: "ellipse", cx: 85, cy: 322, rx: 10, ry: 24 })],
};

function Silhouette() {
  return (
    <g fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth={0.75}>
      <circle cx={100} cy={40} r={18} />
      <rect x={92} y={56} width={16} height={18} rx={6} />
      <path d="M70 78 Q100 70 130 78 L140 100 L131 150 L127 192 L73 192 L69 150 L60 100 Z" />
      <path d="M62 92 L44 196 L54 198 L70 110 Z" strokeLinejoin="round" />
      <path d="M138 92 L156 196 L146 198 L130 110 Z" strokeLinejoin="round" />
      <path d="M74 190 L70 280 L76 352 L94 352 L98 282 L100 200 Z" />
      <path d="M126 190 L130 280 L124 352 L106 352 L102 282 L100 200 Z" />
      <ellipse cx={46} cy={204} rx={6} ry={8} />
      <ellipse cx={154} cy={204} rx={6} ry={8} />
      <ellipse cx={85} cy={358} rx={10} ry={5} />
      <ellipse cx={115} cy={358} rx={10} ry={5} />
    </g>
  );
}

function ShapeEl({ s }: { s: Shape }) {
  if (s.kind === "ellipse") return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} />;
  return <path d={s.d} />;
}

export function BodyMap({
  fill,
  onSelect,
  selected,
  label,
  showLabels = true,
}: {
  fill: (m: Muscle) => string;
  onSelect?: (m: Muscle) => void;
  selected?: Muscle | null;
  label?: (m: Muscle) => string;
  showLabels?: boolean;
}) {
  const view = (title: string, regions: Partial<Record<Muscle, Shape[]>>) => (
    <figure className="flex flex-1 flex-col items-center">
      <svg viewBox="30 14 140 352" className="h-auto w-full max-w-[170px]" role="group" aria-label={`${title} view`}>
        <Silhouette />
        {(Object.entries(regions) as [Muscle, Shape[]][]).map(([m, shapes]) => (
          <motion.g
            key={m}
            role={onSelect ? "button" : "img"}
            tabIndex={onSelect ? 0 : -1}
            aria-label={label ? label(m) : MUSCLE_LABEL[m]}
            onClick={() => onSelect?.(m)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(m)}
            whileTap={onSelect ? { scale: 0.96 } : undefined}
            style={{ transformOrigin: "center", transformBox: "fill-box", cursor: onSelect ? "pointer" : "default", outline: "none" }}
            animate={{ fill: fill(m) }}
            transition={{ duration: 0.25 }}
            stroke={selected === m ? "var(--text)" : "transparent"}
            strokeWidth={selected === m ? 1.5 : 0}
          >
            {shapes.map((s, i) => (
              <ShapeEl key={i} s={s} />
            ))}
          </motion.g>
        ))}
      </svg>
      {showLabels && <figcaption className="mt-1 text-micro text-text-3">{title}</figcaption>}
    </figure>
  );
  return (
    <div className="flex items-start justify-center gap-2">
      {view("Front", FRONT)}
      {view("Back", BACK)}
    </div>
  );
}
