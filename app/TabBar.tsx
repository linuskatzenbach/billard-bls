"use client";

import { Suspense } from "react";
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

function ActiveBar() {
  const path = usePathname();
  return <Bar mine={path === "/mein" || path.startsWith("/mein/")} />;
}

function Bar({ mine }: { mine: boolean | null }) {
  const left = mine === false;
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <div className="tabbar-rail">
        <Link href="/" className={`tab${left ? " active" : ""}`} aria-current={left ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20V11h4v9M10 20V5h4v15M16 20v-6h4v6" />
          </svg>
          <span>Rangliste</span>
        </Link>
        <span className="tab-divider" aria-hidden="true" />
        <Link href="/mein" className={`tab${mine ? " active" : ""}`} aria-current={mine ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.8 20c.8-3.8 3.6-6 7.2-6s6.4 2.2 7.2 6" />
          </svg>
          <span>Mein Bereich</span>
        </Link>
      </div>
    </nav>
  );
}
