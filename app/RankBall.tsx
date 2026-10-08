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

// Ranglistenplatz als Billardkugel. Ab Platz 16 gibt es eine weiße Kugel.
export default function RankBall({ rank }: { rank: number }) {
  const solid = rank >= 1 && rank <= 8;
  const striped = rank >= 9 && rank <= 15;
  const color = solid || striped ? COLORS[(rank - 1) % 8] : "#f4efe4";
  const kind = solid ? "solid" : striped ? "striped" : "cue";

  return (
    <span
      className={`ball ball-${kind}`}
      style={{ "--ball": color } as React.CSSProperties}
      aria-label={`Platz ${rank}`}
    >
      <span className="ball-number">
        <span className="ball-digits">{rank}</span>
      </span>
    </span>
  );
}
