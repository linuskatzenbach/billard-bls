"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Kurze Meldung nach dem Eintragen: "+15 XP" bzw. "Level 5!". Die Werte
// legt das Eintragen-Formular kurz vor dem Wechsel zur Rangliste ab.
export const XP_KEY = "billard-xp";

type Info = { xp: number; levelBefore: number; levelAfter: number };

export default function XpToast() {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(XP_KEY);
      if (!raw) return;
      sessionStorage.removeItem(XP_KEY);
      const d = JSON.parse(raw) as Info;
      if (d && d.xp > 0) setInfo(d);
    } catch {
      // ohne Speicher keine Meldung
    }
  }, []);

  useEffect(() => {
    if (!info) return;
    const t = setTimeout(() => setInfo(null), info.levelAfter > info.levelBefore ? 6500 : 3500);
    return () => clearTimeout(t);
  }, [info]);

  if (!info) return null;
  const up = info.levelAfter > info.levelBefore;
  return (
    <div className={`xp-toast${up ? " up" : ""}`} role="status" onClick={() => setInfo(null)}>
      {up ? (
        <>
          <span className="xp-toast-big">Level {info.levelAfter}!</span>
          <span>
            +{info.xp} XP · neuer Lorbeerkranz · <Link href="/kraenze">ansehen ›</Link>
          </span>
        </>
      ) : (
        <span className="xp-toast-big">+{info.xp} XP</span>
      )}
    </div>
  );
}
