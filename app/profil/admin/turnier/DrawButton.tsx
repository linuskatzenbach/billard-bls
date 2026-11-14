"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Gruppen auslosen bzw. neu auslosen (mit Rückfrage).
export default function DrawButton({ again }: { again: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function draw() {
    if (again && !confirm("Neu auslosen? Die bisherigen Gruppen werden ersetzt.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/turnier", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Hat nicht geklappt.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className={again ? "ghost" : undefined} onClick={draw} disabled={busy}>
        {busy ? "Lose …" : again ? "Neu auslosen" : "Gruppen auslosen"}
      </button>
      {error && <p className="message error">{error}</p>}
    </>
  );
}
