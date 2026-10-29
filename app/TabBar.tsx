"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Leiste unten: links zur Rangliste, rechts in den persönlichen Bereich.
// Die Leiste selbst wird vorab gebaut (ohne Markierung), welcher Tab aktiv
// ist, kommt im Browser dazu.
export default function TabBar() {
  useStickToBottom();
  return (
    <Suspense fallback={<Bar mine={null} />}>
      <ActiveBar />
    </Suspense>
  );
}

// iOS-26-Fehler: Nachdem die Tastatur offen war, rechnet Safari mit einer
// zu kleinen Bildschirmhöhe weiter, und die Leiste rutscht beim Hochscrollen
// ungefähr um eine Tastaturhöhe nach oben (WebKit-Bug 297779). Wir messen
// nach, wo die Leiste wirklich endet, und schieben sie wieder ganz nach unten.
function useStickToBottom() {
  useEffect(() => {
    let shift = 0;
    let frame = 0;
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const typing = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    };
    const fix = () => {
      frame = 0;
      const bar = document.querySelector<HTMLElement>(".tabbar");
      if (!bar) return;
      // Bei offener Tastatur gehört die Leiste hinter die Tastatur – nichts tun.
      if (typing()) {
        if (shift) bar.style.transform = "";
        shift = 0;
        return;
      }
      const vv = window.visualViewport;
      let bottom = Math.max(
        window.innerHeight,
        document.documentElement.clientHeight,
        vv ? vv.offsetTop + vv.height : 0,
      );
      // Als App auf dem Homescreen gibt es keine Safari-Leisten: der sichtbare
      // Bereich ist der ganze Bildschirm. Nur eingreifen, wenn die Abweichung
      // so groß ist wie eine Tastatur – kleine Unterschiede (Statusleiste)
      // sind kein Fehler.
      if (standalone) {
        const portrait = window.matchMedia("(orientation: portrait)").matches;
        const full = portrait ? screen.height : screen.width;
        if (full - bottom > 120) bottom = full;
      }
      const rect = bar.getBoundingClientRect();
      const next = Math.max(0, Math.round(shift + bottom - rect.bottom));
      if (Math.abs(next - shift) < 1) return;
      shift = next;
      bar.style.transform = shift ? `translateY(${shift}px)` : "";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(fix);
    };
    // Nach dem Schließen der Tastatur einmal kurz nachrechnen lassen.
    const onBlur = () => {
      window.setTimeout(() => {
        window.scrollTo(window.scrollX, window.scrollY);
        schedule();
      }, 300);
    };
    const vv = window.visualViewport;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("focusout", onBlur);
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("focusout", onBlur);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
    };
  }, []);
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
