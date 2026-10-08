"use client";

import { useState } from "react";

export type EloPoint = {
  t: string; // ISO-Zeitpunkt
  elo: number;
};

const RANGES = [
  { key: "1m", label: "1 Monat", days: 30 },
  { key: "3m", label: "3 Monate", days: 91 },
  { key: "all", label: "Alles", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const DAY_MS = 24 * 60 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "numeric",
  month: "numeric",
});

function formatDate(iso: string): string {
  const parts = dateFormatter.formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${day}.${month}.`;
}

// Punkte im Zeitraum. Der Verlauf beginnt mit der Elo, die der Spieler zu
// Beginn des Zeitraums hatte, damit die Kurve nicht "in der Luft" startet.
function pointsInRange(history: EloPoint[], days: number | null, now: number): EloPoint[] {
  if (days === null) return history;
  const cutoff = now - days * DAY_MS;
  const inside = history.filter((p) => new Date(p.t).getTime() >= cutoff);
  const before = history.filter((p) => new Date(p.t).getTime() < cutoff);
  const startElo = before.length > 0 ? before[before.length - 1].elo : inside[0]?.elo;
  if (startElo === undefined) return history;
  const start: EloPoint = { t: new Date(cutoff).toISOString(), elo: startElo };
  return before.length > 0 ? [start, ...inside] : inside;
}

// Runde Abstände für die Elo-Marken, höchstens 5 Linien.
function niceStep(span: number): number {
  for (const s of [10, 20, 25, 50, 100, 200, 250, 500]) {
    if (span / s <= 4) return s;
  }
  return 1000;
}

const W = 340;
const H = 190;
const PAD = { left: 40, right: 14, top: 14, bottom: 26 };

export default function EloChart({ history }: { history: EloPoint[] }) {
  const [range, setRange] = useState<RangeKey>("all");
  const [now] = useState(() => Date.now());

  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  let data = pointsInRange(history, days, now);
  // Keine Spiele im Zeitraum: flache Linie bis heute.
  if (data.length === 1) data = [data[0], { t: new Date(now).toISOString(), elo: data[0].elo }];

  const values = data.map((p) => p.elo);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(max - min);
  const lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (hi === lo) hi = lo + step;

  // Jedes Spiel bekommt gleich viel Platz (auch mehrere an einem Abend).
  const n = data.length;
  const x = (i: number) => PAD.left + ((W - PAD.left - PAD.right) * i) / (n - 1);
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - lo) / (hi - lo));

  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  const line = data.map((p, i) => `${x(i).toFixed(1)},${y(p.elo).toFixed(1)}`).join(" ");
  const mid = Math.floor((n - 1) / 2);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h2>Elo-Verlauf</h2>
        <div className="tabs" role="tablist" aria-label="Zeitraum">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              className={`tab${range === r.key ? " active" : ""}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="elo-chart" role="img" aria-label="Elo-Verlauf">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.left - 8} y={y(v)} className="chart-ylab">
              {v}
            </text>
          </g>
        ))}

        <polyline points={line} className="chart-line" />
        <circle cx={x(n - 1)} cy={y(data[n - 1].elo)} r={3.5} className="chart-dot" />

        <text x={PAD.left} y={H - 6} className="chart-xlab" textAnchor="start">
          {formatDate(data[0].t)}
        </text>
        {n > 2 && (
          <text x={x(mid)} y={H - 6} className="chart-xlab" textAnchor="middle">
            {formatDate(data[mid].t)}
          </text>
        )}
        <text x={W - PAD.right} y={H - 6} className="chart-xlab" textAnchor="end">
          {formatDate(data[n - 1].t)}
        </text>
      </svg>
    </div>
  );
}
