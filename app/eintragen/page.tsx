"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLAYERS } from "@/lib/players";
import { Ball, poolBall } from "../RankBall";

// Spieler-Auswahl als antippbare Kugeln. Jeder Spieler hat eine feste
// Kugelfarbe (nach Reihenfolge in lib/players.ts) mit seinem Anfangsbuchstaben.
function PlayerPicker({
  legend,
  value,
  onChange,
  blockedId,
}: {
  legend: string;
  value: string;
  onChange: (id: string) => void;
  blockedId: string;
}) {
  return (
    <fieldset className="picker">
      <legend>{legend}</legend>
      <div className="picker-grid">
        {PLAYERS.map((p, i) => {
          const selected = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`picker-option${selected ? " selected" : ""}`}
              aria-pressed={selected}
              disabled={p.id === blockedId}
              onClick={() => onChange(selected ? "" : p.id)}
            >
              <Ball label={p.name.charAt(0).toUpperCase()} {...poolBall(i + 1)} />
              <span className="picker-name">{p.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function EintragenPage() {
  const router = useRouter();
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "loading" } | { type: "error"; message: string } | { type: "success"; message: string }
  >({ type: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!winnerId || !loserId) {
      setStatus({ type: "error", message: "Bitte Gewinner und Verlierer auswählen." });
      return;
    }

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
      setWinnerId("");
      setLoserId("");
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
        <PlayerPicker
          legend="Gewinner"
          value={winnerId}
          onChange={setWinnerId}
          blockedId={loserId}
        />

        <PlayerPicker
          legend="Verlierer"
          value={loserId}
          onChange={setLoserId}
          blockedId={winnerId}
        />

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
