"use client";

import { useEffect } from "react";

// Beim Öffnen von "Mein Bereich": neue Spiele als gesehen markieren,
// damit der rote Punkt verschwindet.
export default function MarkSeen({ needed }: { needed: boolean }) {
  useEffect(() => {
    if (!needed) return;
    fetch("/api/me/seen", { method: "POST" })
      .then(() => window.dispatchEvent(new Event("billard:seen")))
      .catch(() => {});
  }, [needed]);
  return null;
}
