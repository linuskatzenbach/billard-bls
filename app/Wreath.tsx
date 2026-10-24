import type React from "react";
import { Ball, poolBall } from "./RankBall";

// Lorbeerkranz um eine Kugel. Jedes Level sieht anders aus:
// 6 Materialien (Olivenzweig, Bronze, Silber, Gold, Gold mit Rubinen,
// Champion) mit je 3 Stufen. In den ersten vier Materialien wächst der Kranz
// von einem kurzen Zweig zu einem fast geschlossenen Kranz; danach kommen
// Rubine bzw. Sterne dazu.

const MATERIALS = [
  { light: "#b6d488", dark: "#4f7a2e", stem: "#3e5f24" },
  { light: "#f3b880", dark: "#8a4c1c", stem: "#6a3812" },
  { light: "#ffffff", dark: "#8a9098", stem: "#6b7078" },
  { light: "#fff1a8", dark: "#a8801a", stem: "#7a5a10" },
  { light: "#fff1a8", dark: "#a8801a", stem: "#7a5a10" },
  { light: "#fff8d6", dark: "#c99a1a", stem: "#8a6a12" },
];
const STAGES = [
  { n: 5, span: 70 },
  { n: 8, span: 115 },
  { n: 12, span: 162 },
];
const LEAF = "M0 0 C3 -3.4 8.5 -3.4 12 0 C8.5 3.4 3 3.4 0 0Z";
const STAR = "M0 -5 L1.5 -1.6 5 -1.5 2.3 .8 3.2 4.3 0 2.4 -3.2 4.3 -2.3 .8 -5 -1.5 -1.5 -1.6Z";

const f = (n: number) => n.toFixed(2);

export function WreathSvg({ level }: { level: number }) {
  const L = Math.max(1, Math.min(18, Math.round(level)));
  const ti = Math.min(Math.floor((L - 1) / 3), 5);
  const st = (L - 1) % 3;
  const m = MATERIALS[ti];
  const { n, span } = STAGES[ti >= 4 ? 2 : st];
  const R = 40.5;
  const c = 50;
  const rad = (a: number) => (a * Math.PI) / 180;
  const p = (a: number, r = R) => [c + r * Math.cos(rad(a)), c + r * Math.sin(rad(a))];

  const stems: React.ReactNode[] = [];
  const leaves: React.ReactNode[] = [];
  const gems: React.ReactNode[] = [];
  const gemAt = ti === 5 ? [1, 5, 9] : ti === 4 ? [[5], [3, 7], [1, 5, 9]][st] : [];

  for (const side of [-1, 1]) {
    const [x0, y0] = p(90 + side * 6);
    const [x1, y1] = p(90 + side * span);
    stems.push(
      <path
        key={`s${side}`}
        d={`M${f(x0)} ${f(y0)} A${R} ${R} 0 0 ${side > 0 ? 1 : 0} ${f(x1)} ${f(y1)}`}
        fill="none"
        stroke={m.stem}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    );
    for (let i = 0; i < n; i++) {
      const a = 90 + side * (12 + (span - 12) * (i / (n - 1)));
      const tang = a + side * 90;
      const sz = 1.05 - 0.3 * (i / (n - 1));
      (
        [
          [side * -32, 1.04, m.light],
          [side * 32, 0.96, m.dark],
        ] as const
      ).forEach(([off, rr, fill], k) => {
        const [x, y] = p(a, R * rr);
        leaves.push(
          <path
            key={`l${side}${i}${k}`}
            transform={`translate(${f(x)} ${f(y)}) rotate(${(tang + off).toFixed(1)}) scale(${sz.toFixed(2)})`}
            d={LEAF}
            fill={fill}
            stroke={m.stem}
            strokeWidth={0.45}
          />
        );
      });
      if (gemAt.includes(i)) {
        const [gx, gy] = p(a, R + 5.8);
        gems.push(
          <g key={`g${side}${i}`}>
            <circle cx={f(gx)} cy={f(gy)} r={2.9} fill="#d2233a" stroke="#7a0f1d" strokeWidth={0.5} />
            <circle cx={f(gx - 0.7)} cy={f(gy - 0.7)} r={0.7} fill="#fff" opacity={0.85} />
          </g>
        );
      }
    }
  }

  const by = c + R + 1;
  const bow =
    ti >= 1 ? (
      <g>
        <path
          d={`M${c} ${by} l-7 9 l3 -.5 l1.5 2.5 Z M${c} ${by} l7 9 l-3 -.5 l-1.5 2.5 Z`}
          fill={m.dark}
          stroke={m.stem}
          strokeWidth={0.5}
        />
        <circle cx={c} cy={by} r={3} fill={m.light} stroke={m.stem} strokeWidth={0.6} />
      </g>
    ) : null;

  let stars: React.ReactNode = null;
  if (ti === 5) {
    const list =
      st === 0
        ? [[50, -1, 1.5]]
        : st === 1
          ? [
              [50, -2, 1.6],
              [36, 2.5, 1.05],
              [64, 2.5, 1.05],
            ]
          : [
              [50, -3, 1.8],
              [34, 2, 1.2],
              [66, 2, 1.2],
            ];
    stars = list.map(([x, y, k], i) => (
      <path key={i} transform={`translate(${x} ${y}) scale(${k})`} d={STAR} fill="#fff1a8" stroke="#a8801a" strokeWidth={0.5} />
    ));
  }
  const glow = ti === 5 && st >= 1;

  return (
    <svg
      viewBox="0 0 100 100"
      className={`wreath-svg${glow ? (st === 2 ? " glow-strong" : " glow") : ""}`}
      aria-hidden="true"
    >
      {stems}
      {leaves}
      {gems}
      {bow}
      {stars}
    </svg>
  );
}

// Kugel im Kranz. rank = Platz in der Elo-Rangliste (null → weiße Kugel).
export default function Wreath({
  level,
  rank,
  size = "2.6rem",
  label,
  children,
  locked = false,
  className = "",
}: {
  level: number;
  rank?: number | null;
  size?: string;
  label?: string;
  children?: React.ReactNode;
  locked?: boolean;
  className?: string;
}) {
  const ball = rank ? poolBall(rank) : { color: "#f4efe4", kind: "cue" as const };
  return (
    <span
      className={`wreath${locked ? " locked" : ""} ${className}`}
      style={{ "--w": size } as React.CSSProperties}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <WreathSvg level={level} />
      <span className="wreath-center">
        {children ?? <Ball label={rank ? String(rank) : ""} {...ball} />}
      </span>
    </span>
  );
}
