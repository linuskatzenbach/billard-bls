"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLAYERS } from "@/lib/players";

export default function EintragenPage() {
  const router = useRouter();
  const [winnerId, setWinnerId] = useState(PLAYERS[0]?.id ?? "");
  const [loserId, setLoserId] = useState(PLAYERS[1]?.id ?? "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "loading" } | { type: "error"; message: string } | { type: "success"; message: string }
  >({ type: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (winnerId === loserId) {
      setStatus({ type: "error", message: "Gewinner und Verlierer müssen unterschiedlich sein." });
      return;
    }

    setStatus({ type: "loading" });

    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId, loserId, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", message: data.error ?? "Etwas ist schiefgelaufen." });
        return;
      }

      setStatus({ type: "success", message: "Ergebnis gespeichert!" });
      setPassword("");
      router.refresh();
    } catch {
      setStatus({ type: "error", message: "Verbindung fehlgeschlagen. Bitte erneut versuchen." });
    }
  }

  return (
    <>
      <h1>Ergebnis eintragen</h1>
      <p className="subtitle">Wer hat gegen wen gewonnen?</p>

      <form onSubmit={handleSubmit}>
        <label>
          Gewinner
          <select value={winnerId} onChange={(e) => setWinnerId(e.target.value)}>
            {PLAYERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Verlierer
          <select value={loserId} onChange={(e) => setLoserId(e.target.value)}>
            {PLAYERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={status.type === "loading"}>
          {status.type === "loading" ? "Speichert…" : "Ergebnis speichern"}
        </button>

        {status.type === "error" && <p className="message error">{status.message}</p>}
        {status.type === "success" && <p className="message success">{status.message}</p>}
      </form>

      <Link href="/" className="nav-link">
        ← Zurück zur Rangliste
      </Link>
    </>
  );
}
