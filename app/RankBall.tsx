import type React from "react";

// Klassische Pool-Farben: 1 gelb, 2 blau, 3 rot, 4 lila, 5 orange,
// 6 grün, 7 weinrot, 8 schwarz. 9–15 sind die gestreiften Varianten.
const COLORS = [
  "#f2c230", // 1
  "#1f4fb4", // 2
  "#c8322a", // 3
  "#5b2d8e", // 4
  "#ee7a1f", // 5
  "#1d7a44", // 6
  "#7a2232", // 7
  "#151515", // 8
];

export type BallKind = "solid" | "striped" | "cue";

// Billardkugel mit beliebiger Beschriftung (Zahl oder Buchstabe).
export function Ball({
  label,
  color,
  kind,
  ariaLabel,
}: {
  label: string;
  color: string;
  kind: BallKind;
  ariaLabel?: string;
}) {
  return (
    <span
      className={`ball ball-${kind}`}
      style={{ "--ball": color } as React.CSSProperties}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <span className="ball-number">
        {/* Fraunces hat Versalziffern (so hoch wie Großbuchstaben); per
            text-box auf Versalhöhe beschnitten sitzt jede Zahl ohne
            Einzelkorrektur mittig im Kreis. */}
        <span className="ball-digits">{label}</span>
      </span>
    </span>
  );
}

// Kugel Nr. n (1–15) aus dem Pool-Satz; ab 16 eine weiße Kugel.
export function poolBall(n: number): { color: string; kind: BallKind } {
  if (n >= 1 && n <= 8) return { color: COLORS[n - 1], kind: "solid" };
  if (n >= 9 && n <= 15) return { color: COLORS[n - 9], kind: "striped" };
  return { color: "#f4efe4", kind: "cue" };
}

// Ranglistenplatz als Billardkugel.
export default function RankBall({ rank }: { rank: number }) {
  return <Ball label={String(rank)} {...poolBall(rank)} ariaLabel={`Platz ${rank}`} />;
}
