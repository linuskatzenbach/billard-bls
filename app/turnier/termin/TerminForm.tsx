"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Tag, Uhrzeit und (optional) Ort einer K.O.-Serie. Sehen alle im Turnier-Tab.
export default function TerminForm({ ko, day: day0, time: time0, place: place0 }: { ko: string; day: string; time: string; place: string }) {
  const router = useRouter();
  const [day, setDay] = useState(day0);
  const [time, setTime] = useState(time0);
  const [place, setPlace] = useState(place0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/turnier/termin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ko, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Etwas ist schiefgelaufen.");
      router.push("/turnier");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <form
      className="tm-form"
      onSubmit={(e) => {
        e.preventDefault();
        send({ day, time, place });
      }}
    >
      <div className="tm-row">
        <label>
          Tag
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </label>
        <label>
          Uhrzeit
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
      </div>
      <label>
        Ort <span className="field-help">optional</span>
        <input type="text" value={place} maxLength={60} placeholder="Wo wird gespielt?" onChange={(e) => setPlace(e.target.value)} />
      </label>
      <p className="field-help">Der Termin steht für alle sichtbar im Turnierbaum – so können andere zum Zuschauen kommen.</p>
      <button type="submit" disabled={busy}>
        {busy ? "Speichern…" : day0 ? "Termin ändern" : "Termin eintragen"}
      </button>
      {day0 && (
        <button type="button" className="tm-clear" disabled={busy} onClick={() => send({ clear: true })}>
          Termin löschen
        </button>
      )}
      {error && <p className="message error">{error}</p>}
    </form>
  );
}
