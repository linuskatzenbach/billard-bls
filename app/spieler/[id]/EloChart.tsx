"use client";

import { useState } from "react";

export type EloPoint = {
  t: string; // ISO-Zeitpunkt
  elo: number;
};

const RANGES = [
  { key: "1w", label: "1 Woche", days: 7 },
  { key: "1m", label: "1 Monat", days: 30 },
  { key: "all", label: "Alles", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

// Kalendertag (nach deutscher Zeit) als "JJJJ-MM-TT".
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

// Kalendertag um n Tage verschieben (reine Datumsrechnung, ohne Zeitzone).
function shiftDay(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function formatDay(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}.${m}.`;
}

type DayPoint = {
  day: string; // Tag, zu dem der Punkt gehört
  elo: number;
};

// Ein Punkt pro Kalendertag (Elo am Ende des Tages). Ein zusätzlicher
// Punkt vorne steht für die Elo zu Beginn des ersten Tages. An Tagen ohne
// Spiel bleibt die Elo gleich, die Linie verläuft dort also waagerecht.
function dailySeries(history: EloPoint[], days: number | null, today: string): DayPoint[] {
  // Links beginnt der Graph am Anfang des Zeitraums, aber nie vor dem Tag
  // des ersten Spiels. Rechts läuft er immer bis heute.
  const firstGameDay = dayKey(new Date(history[0].t));
  const windowStart = days === null ? firstGameDay : shiftDay(today, -(days - 1));
  const firstDay = windowStart > firstGameDay ? windowStart : firstGameDay;

  const entries = history.map((p) => ({ day: dayKey(new Date(p.t)), elo: p.elo }));
  // history[0] ist die Start-Elo vor dem allerersten Spiel.
  let elo = history[0].elo;
  let i = 0;
  while (i < entries.length && entries[i].day < firstDay) {
    elo = entries[i].elo;
    i += 1;
  }

  const series: DayPoint[] = [{ day: firstDay, elo }];
  for (let day = firstDay; day <= today; day = shiftDay(day, 1)) {
    while (i < entries.length && entries[i].day <= day) {
      elo = entries[i].elo;
      i += 1;
    }
    series.push({ day, elo });
  }
  return series;
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
const PAD = { left: 40, right: 18, top: 14, bottom: 26 };

export default function EloChart({ history }: { history: EloPoint[] }) {
  const [range, setRange] = useState<RangeKey>("all");
  const [today] = useState(() => dayKey(new Date()));

  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  const data = dailySeries(history, days, today);

  const values = data.map((p) => p.elo);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(max - min);
  const lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (hi === lo) hi = lo + step;

  // x-Achse = Zeit: jeder Tag bekommt gleich viel Platz. Der Punkt eines
  // Tages sitzt in der Mitte seines Tages, also genau über seinem Datum.
  // Punkt 0 (Elo vor dem ersten Tag) liegt am linken Rand.
  const n = data.length;
  const totalDays = n - 1;
  const pos = (k: number) => (k === 0 ? 0 : k - 0.5);
  const maxPos = pos(n - 1);
  const x = (k: number) => PAD.left + ((W - PAD.left - PAD.right) * pos(k)) / maxPos;
  const y = (v: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - lo) / (hi - lo));

  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  const line = data.map((p, k) => `${x(k).toFixed(1)},${y(p.elo).toFixed(1)}`).join(" ");

  // Beschriftete Tage: erster, mittlerer und letzter Tag (Punkt k = Tag k - 1).
  const labelPoints = Array.from(
    new Set([1, 1 + Math.floor((totalDays - 1) / 2), totalDays])
  );

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

        {labelPoints.map((k) => (
          <text key={k} x={x(k)} y={H - 6} className="chart-xlab" textAnchor="middle">
            {formatDay(data[k].day)}
          </text>
        ))}
      </svg>
    </div>
  );
}
