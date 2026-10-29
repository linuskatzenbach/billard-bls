"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Leiste unten: links zur Rangliste, rechts in den persönlichen Bereich.
// Die Leiste selbst wird vorab gebaut (ohne Markierung), welcher Tab aktiv
// ist, kommt im Browser dazu.
export default function TabBar() {
  return (
    <Suspense fallback={<Bar mine={null} />}>
      <ActiveBar />
    </Suspense>
  );
}

let lastCheck = 0;
let lastDot = false;

const isMine = (path: string) => path === "/profil" || path.startsWith("/profil/");

// Beim Antippen wird sofort nur der neue Tab markiert, auch wenn die Seite
// noch lädt und die Adresse sich noch nicht geändert hat.
function ActiveBar() {
  const path = usePathname();
  const [pending, setPending] = useState<boolean | null>(null);
  const [dot, setDot] = useState(false);
  useEffect(() => setPending(null), [path]);
  // Roter Punkt: jemand hat ein Spiel mit dir eingetragen (bzw. für den
  // Admin: es gibt einen neuen Widerspruch). Wird bei jedem Seitenwechsel
  // und beim Zurückkehren in die App neu abgefragt.
  useEffect(() => {
    let alive = true;
    // Höchstens einmal pro Minute nachfragen (schont die Datenbank).
    const check = (force?: unknown) => {
      if (force !== true && Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      return fetch("/api/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          lastDot = Boolean(d.unread);
          if (alive) setDot(lastDot);
        })
        .catch(() => {});
    };
    setDot(lastDot);
    check();
    const forced = () => check(true);
    window.addEventListener("billard:seen", forced);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("billard:seen", forced);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path]);
  const current = isMine(path);
  return (
    <Bar
      mine={pending ?? current}
      dot={dot}
      onPick={(mine) => setPending(mine === current ? null : mine)}
    />
  );
}

function Bar({ mine, dot = false, onPick }: { mine: boolean | null; dot?: boolean; onPick?: (mine: boolean) => void }) {
  const left = mine === false;
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <div className="tabbar-rail">
        <Link href="/" onClick={() => onPick?.(false)} className={`navtab${left ? " active" : ""}`} aria-current={left ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20V11h4v9M10 20V5h4v15M16 20v-6h4v6" />
          </svg>
          <span>Rangliste</span>
        </Link>
        <span className="navtab-divider" aria-hidden="true" />
        <Link href="/profil" onClick={() => onPick?.(true)} className={`navtab${mine ? " active" : ""}`} aria-current={mine ? "page" : undefined}>
          <span className="navtab-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.8 20c.8-3.8 3.6-6 7.2-6s6.4 2.2 7.2 6" />
            </svg>
            {dot && <span className="navtab-dot" aria-label="Neues" />}
          </span>
          <span>Mein Bereich</span>
        </Link>
      </div>
    </nav>
  );
}
