"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Zwischenspeicher leeren, damit Änderungen direkt in der Datenbank sofort
// in Rangliste, Profilen und Turnier erscheinen.
export default function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data.error ?? "Hat nicht geklappt." });
      else {
        setMsg({ ok: true, text: "Erledigt – alle sehen jetzt den aktuellen Stand." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Hat nicht geklappt." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" onClick={refresh} disabled={busy}>
        {busy ? "Lade neu …" : "Rangliste neu laden"}
      </button>
      {msg && <p className={msg.ok ? "message success" : "message error"}>{msg.text}</p>}
    </>
  );
}
