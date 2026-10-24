"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LinkLogin({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? "" : "Dieser Link ist unvollständig.");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Das hat nicht geklappt.");
      window.dispatchEvent(new Event("billard:seen"));
      router.replace(data.next ?? "/profil");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="mailart" aria-hidden="true">
        🎱
      </div>
      <h1>Anmelden</h1>
      <p className="subtitle">Ein Tipp noch, dann bist du drin.</p>
      {token && (
        <button type="button" className="bigbtn" onClick={go} disabled={busy}>
          {busy ? "Melde an…" : "Jetzt anmelden"}
        </button>
      )}
      {error && (
        <>
          <p className="message error">{error}</p>
          <Link href="/profil" className="nav-link">
            Neuen Link anfordern
          </Link>
        </>
      )}
    </div>
  );
}
