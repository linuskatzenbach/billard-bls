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

// Fraunces hat Mediävalziffern: 0, 1, 2 sind nur so hoch wie ein "x",
// 3, 4, 5, 7, 9 reichen unter die Grundlinie, 6 und 8 sind so hoch wie
// Großbuchstaben. Damit jede Zahl optisch mittig im Kreis sitzt, wird sie
// je nach Ziffernform ein Stück verschoben (Werte in em, gemessen).
const CAP = 0.7;
const X_HEIGHT = 0.49;
const DESCENDER = 0.25;

function verticalNudge(digits: string): number {
  const top = /[68]/.test(digits) ? CAP : X_HEIGHT;
  const bottom = /[34579]/.test(digits) ? -DESCENDER : 0;
  // Abstand der Ziffernmitte zur Mitte der Großbuchstabenhöhe
  // (auf die ist die Zeile per text-box beschnitten).
  return CAP / 2 - (top + bottom) / 2;
}

type BallKind = "solid" | "striped" | "cue";

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
  // Buchstaben sind so hoch wie Großbuchstaben und brauchen keine Korrektur.
  const nudge = /^\d+$/.test(label) ? verticalNudge(label) : 0;
  return (
    <span
      className={`ball ball-${kind}`}
      style={{ "--ball": color } as React.CSSProperties}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <span className="ball-number">
        <span
          className="ball-digits"
          style={{ transform: `translateY(${(-nudge).toFixed(3)}em)` }}
        >
          {label}
        </span>
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
