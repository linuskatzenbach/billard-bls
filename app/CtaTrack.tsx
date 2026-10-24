"use client";

import { useEffect, useRef } from "react";

// Queue, weiße Kugel und Loch im Knopf "Ergebnis eintragen".
//
// Safari auf dem iPhone hält CSS-Animationen manchmal an und startet sie
// nicht wieder – etwa wenn die App im Hintergrund war, die Seite aus dem
// Zurück-Speicher kommt oder Next.js die Seite beim Wegnavigieren versteckt
// und später wieder einblendet. Dann stand die Kugel still. Deshalb wird
// die Animation in diesen Momenten ausdrücklich neu gestartet.
export default function CtaTrack() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const restart = () => {
      const parts = el.querySelectorAll<HTMLElement>(".cta-ball, .cta-cue");
      parts.forEach((n) => {
        if (typeof n.getAnimations === "function") {
          for (const a of n.getAnimations()) {
            a.cancel();
            a.play();
          }
        } else {
          n.style.animation = "none";
          void n.offsetWidth; // Neuberechnung erzwingen
          n.style.animation = "";
        }
      });
    };

    const onVisible = () => document.visibilityState === "visible" && restart();
    const onShow = () => restart();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("focus", onShow);

    // Wieder sichtbar geworden (z. B. nach Seitenwechsel zurück)?
    let wasVisible = false;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            const vis = entries.some((e) => e.isIntersecting);
            if (vis && !wasVisible) restart();
            wasVisible = vis;
          })
        : null;
    io?.observe(el);
    restart();

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("focus", onShow);
      io?.disconnect();
    };
  }, []);

  return (
    <span className="cta-track" aria-hidden="true" ref={ref}>
      <span className="cta-pocket" />
      <span className="cta-cue" />
      <span className="cta-ball" />
    </span>
  );
}
