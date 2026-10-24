"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Wreath from "../Wreath";

export default function Onboarding({ suggested, cohorts }: { suggested: string; cohorts: string[] }) {
  const router = useRouter();
  const [name, setName] = useState(suggested);
  const [cohort, setCohort] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cohort }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Das hat nicht geklappt.");
      window.dispatchEvent(new Event("billard:seen"));
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const first = name.trim().split(" ")[0];
    return (
      <div className="auth welcome">
        <div className="welcome-wreath">
          <Wreath level={1} rank={null} size="140px" />
        </div>
        <h1>Willkommen, {first}!</h1>
        <p className="subtitle">Dein erster Lorbeerzweig wartet schon.</p>
        <div className="kpis">
          <div className="kpi card">
            <span className="kpi-l">Elo</span>
            <span className="kpi-v">1.500</span>
            <span className="kpi-s">Start</span>
          </div>
          <div className="kpi card">
            <span className="kpi-l">Level</span>
            <span className="kpi-v">1</span>
            <span className="kpi-s">Olivenzweig</span>
          </div>
          <div className="kpi card">
            <span className="kpi-l">Platz</span>
            <span className="kpi-v">–</span>
            <span className="kpi-s">vorläufig</span>
          </div>
        </div>
        <div className="card slots-card">
          <div className="slots-title">Noch 3 Spiele bis zur Elo-Rangliste</div>
          <div className="slots">
            <i>1</i>
            <i>2</i>
            <i>3</i>
          </div>
          <div className="slots-help">In „Wochensieger“ und „Aktivität“ zählst du ab sofort.</div>
        </div>
        <Link href="/eintragen" className="cta">
          <span className="cta-felt">
            <span className="cta-label">Erstes Spiel eintragen</span>
          </span>
        </Link>
        <Link href="/mein" className="nav-link">
          Zu meinem Profil
        </Link>
      </div>
    );
  }

  return (
    <div className="auth">
      <h1>Wer bist du?</h1>
      <p className="subtitle">So erscheinst du in der Rangliste.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Anzeigename
          <input
            type="text"
            value={name}
            maxLength={20}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            required
          />
          <span className="field-help">Am besten Vorname und Anfangsbuchstabe, z. B. „Max M.“</span>
        </label>
        <fieldset className="chips-field">
          <legend>Jahrgang</legend>
          <div className="chips">
            {cohorts.map((c) => (
              <button
                type="button"
                key={c}
                className={`chip${cohort === c ? " on" : ""}`}
                onClick={() => setCohort(c)}
                aria-pressed={cohort === c}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={busy || name.trim().length < 2 || !cohort}>
          {busy ? "Lege an…" : "Profil anlegen"}
        </button>
        {error && <p className="message error">{error}</p>}
      </form>
      <p className="auth-small">
        Mit dem Anlegen erscheinen dein Anzeigename und deine Spiele öffentlich in der Rangliste.{" "}
        <Link href="/datenschutz">Datenschutz</Link>
      </p>
    </div>
  );
}
