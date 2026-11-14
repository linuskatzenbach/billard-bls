"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Auslosung veröffentlichen (mit Rückfrage) – danach nicht mehr neu losbar.
export default function PublishButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function publish() {
    if (!confirm("Gruppen und Turnierbaum jetzt im Turnier-Tab veröffentlichen? Danach kann nicht mehr neu gelost werden.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/turnier/publish", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Hat nicht geklappt.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" onClick={publish} disabled={busy}>
        {busy ? "Veröffentliche …" : "Veröffentlichen"}
      </button>
      {error && <p className="message error">{error}</p>}
    </>
  );
}
