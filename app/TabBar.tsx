"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Leiste unten: Rangliste · Spiel eintragen (+) · persönlicher Bereich.
// Nur Symbole, die aktuelle Seite liegt auf Filz.
// Die Leiste selbst wird vorab gebaut (ohne Markierung), welcher Tab aktiv
// ist, kommt im Browser dazu.
export default function TabBar() {
  return (
    <Suspense fallback={<Bar tab={null} />}>
      <ActiveBar />
    </Suspense>
  );
}

let lastCheck = 0;
let lastDot = false;

type Tab = "rang" | "plus" | "mein";
const tabOf = (path: string): Tab => {
  if (path === "/eintragen" || path.startsWith("/eintragen/")) return "plus";
  if (/^\/(profil|abzeichen|kraenze)(\/|$)/.test(path)) return "mein";
  return "rang";
};

// Beim Antippen wird sofort nur der neue Tab markiert, auch wenn die Seite
// noch lädt und die Adresse sich noch nicht geändert hat.
function ActiveBar() {
  const path = usePathname();
  const [pending, setPending] = useState<Tab | null>(null);
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
  const current = tabOf(path);
  return <Bar tab={pending ?? current} dot={dot} onPick={(t) => setPending(t === current ? null : t)} />;
}

function Bar({ tab, dot = false, onPick }: { tab: Tab | null; dot?: boolean; onPick?: (t: Tab) => void }) {
  const cls = (t: Tab) => `navtab${tab === t ? " active" : ""}`;
  const cur = (t: Tab) => (tab === t ? ("page" as const) : undefined);
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <div className="tabbar-rail three">
        <Link href="/" onClick={() => onPick?.("rang")} className={cls("rang")} aria-current={cur("rang")} aria-label="Rangliste">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20V11h4v9M10 20V5h4v15M16 20v-6h4v6" />
          </svg>
        </Link>
        <Link
          href="/eintragen"
          onClick={() => onPick?.("plus")}
          className={`${cls("plus")} navtab-plus`}
          aria-current={cur("plus")}
          aria-label="Spiel eintragen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
        <Link href="/profil" onClick={() => onPick?.("mein")} className={cls("mein")} aria-current={cur("mein")} aria-label="Mein Bereich">
          <span className="navtab-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.8 20c.8-3.8 3.6-6 7.2-6s6.4 2.2 7.2 6" />
            </svg>
            {dot && <span className="navtab-dot" aria-label="Neues" />}
          </span>
        </Link>
      </div>
    </nav>
  );
}
