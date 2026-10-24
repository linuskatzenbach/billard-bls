"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Anmeldung per Uni-Mail: Link oder 6-stelliger Code, kein Passwort.
export default function EmailLogin() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "sent">("email");
  const [local, setLocal] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resentAt, setResentAt] = useState(0);

  const fullEmail = (v: string) => {
    const t = v.trim().toLowerCase();
    return t.includes("@") ? t : `${t}@law-school.de`;
  };

  async function request(addr: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Das hat nicht geklappt.");
      setEmail(data.email ?? addr);
      setStep("sent");
      setResentAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(value: string) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Der Code stimmt nicht.");
      window.dispatchEvent(new Event("billard:seen"));
      router.push(data.next ?? "/mein");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
      setBusy(false);
    }
  }

  if (step === "sent") {
    return (
      <div className="auth">
        <div className="mailart" aria-hidden="true">
          📬
        </div>
        <h1>Schau in dein Postfach</h1>
        <p className="subtitle">
          Wir haben dir einen Link an
          <br />
          <b className="hl">{email}</b> geschickt.
        </p>
        <p className="auth-text">Tippe in der Mail auf „Jetzt anmelden“ – oder gib hier den 6-stelligen Code aus der Mail ein:</p>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submitCode(code);
          }}
        >
          <input
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) void submitCode(v);
            }}
            aria-label="Code aus der Mail"
          />
          <button type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Prüfe…" : "Anmelden"}
          </button>
          {error && <p className="message error">{error}</p>}
        </form>
        <p className="auth-small">
          Nichts angekommen? Schau auch im Spam-Ordner.{" "}
          <button
            type="button"
            className="linkish"
            disabled={busy || Date.now() - resentAt < 30_000}
            onClick={() => void request(email)}
          >
            Erneut senden
          </button>{" "}
          ·{" "}
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
          >
            Andere Adresse
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth">
      <h1>Mitspielen</h1>
      <p className="subtitle">Melde dich mit deiner Uni-Mail an – ohne Passwort.</p>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void request(fullEmail(local));
        }}
      >
        <label>
          Uni-Mail-Adresse
          <span className="mail-field">
            <input
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="vorname.nachname"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              required
            />
            {!local.includes("@") && <span className="mail-suffix">@law-school.de</span>}
          </span>
        </label>
        <button type="submit" disabled={busy || local.trim().length < 3}>
          {busy ? "Sende…" : "Anmeldelink senden"}
        </button>
        {error && <p className="message error">{error}</p>}
      </form>
      <div className="card auth-note">
        <span aria-hidden="true">📱</span>
        <span>
          <b>Tipp: Als App starten:</b> in Safari auf „Teilen“ → „Zum Home-Bildschirm“. Dann öffnet sich Billard BLS
          wie eine App, aber ohne Speicherplatz wegzunehmen.
        </span>
      </div>
    </div>
  );
}
