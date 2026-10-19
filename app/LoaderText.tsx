"use client";

import { useEffect, useState } from "react";

const SPRUECHE = [
  "Kugeln werden aufgebaut …",
  "Kreide wird aufgetragen …",
  "Queue wird ausgerichtet …",
  "Tisch wird gebürstet …",
  "Dreieck wird zurechtgerückt …",
  "Elo-Zahlen werden poliert …",
  "Banden werden geprüft …",
  "Weiße wird in Position gebracht …",
  "Die 8 wartet geduldig …",
  "Effet wird berechnet …",
  "Taschen werden geleert …",
  "Ausreden werden vorbereitet …",
  "Rangliste wird nachgezählt …",
  "Angesagt: Ecke links …",
  "Konzentration …",
];

const INTERVALL_MS = 2200;
const BLENDE_MS = 250;

function gemischt<T>(liste: T[]): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Wechselt die Lade-Sprüche in zufälliger Reihenfolge durch, ohne
// dass ein Spruch zweimal kommt, bevor alle einmal dran waren.
export default function LoaderText() {
  const [reihe, setReihe] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [sichtbar, setSichtbar] = useState(true);

  useEffect(() => {
    // Erst im Browser mischen, sonst passt der Server-HTML nicht dazu.
    setReihe(gemischt(SPRUECHE));
  }, []);

  useEffect(() => {
    if (!reihe) return;
    let blende: ReturnType<typeof setTimeout>;
    const takt = setInterval(() => {
      setSichtbar(false);
      blende = setTimeout(() => {
        setIndex((i) => (i + 1) % reihe.length);
        setSichtbar(true);
      }, BLENDE_MS);
    }, INTERVALL_MS);
    return () => {
      clearInterval(takt);
      clearTimeout(blende);
    };
  }, [reihe]);

  return (
    <p
      className="loader-text"
      aria-live="polite"
      style={{ opacity: reihe && sichtbar ? undefined : 0 }}
    >
      {reihe ? reihe[index] : " "}
    </p>
  );
}
