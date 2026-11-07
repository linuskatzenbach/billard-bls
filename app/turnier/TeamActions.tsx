"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Wreath from "../Wreath";
import type { Pick } from "@/lib/picks";

export type Candidate = Pick & { status: "free" | "team" | "noaccount" | "asked"; requestId?: number };

const NOTE: Record<Candidate["status"], string | null> = {
  free: null,
  team: "hat schon ein Team",
  noaccount: "noch nicht angemeldet",
  asked: "hat dich angefragt",
};

// Eigene Team-Anfragen fürs 2v2-Turnier: eingehende annehmen/ablehnen,
// eigene zurückziehen oder einen Partner anfragen (immer nur eine offen).
export default function TeamActions({
  incoming,
  outgoing,
  candidates,
  deadline,
}: {
  incoming: { id: number; from: Pick }[];
  outgoing: { id: number; to: Pick } | null;
  candidates: Candidate[];
  deadline: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "invite" | "accept"; pick: Pick; requestId?: number } | null>(null);
  const [query, setQuery] = useState("");

  async function act(body: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/turnier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Hat nicht geklappt.");
      setConfirm(null);
      // Roter Punkt in der Leiste neu abfragen.
      window.dispatchEvent(new Event("billard:seen"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const shown = q
    ? candidates.filter((p) => p.name.toLowerCase().includes(q) || (p.cohort ?? "").toLowerCase().includes(q))
    : candidates;

  if (confirm) {
    const { kind, pick } = confirm;
    return (
      <div className="card tn-box">
        <div className="tn-confirm-who">
          <Wreath level={pick.level} rank={pick.rank} size="3rem" />
          <b>{pick.name}</b>
        </div>
        {kind === "accept" ? (
          <p>
            Mit <b>{pick.name}</b> ins Turnier? Danach steht euer Team fest und kann <b>nicht mehr geändert</b> werden.
          </p>
        ) : (
          <p>
            <b>{pick.name}</b> bekommt eine Anfrage (in der App und per Mail). Sobald {pick.name} annimmt, steht euer Team fest.
          </p>
        )}
        <div className="tn-buttons">
          <button
            type="button"
            className="tn-btn primary"
            disabled={busy}
            onClick={() =>
              act(kind === "accept" ? { action: "accept", requestId: confirm.requestId } : { action: "invite", playerId: pick.id })
            }
          >
            {busy ? "…" : kind === "accept" ? "Ja, wir spielen zusammen" : "Anfrage senden"}
          </button>
          <button type="button" className="tn-btn" disabled={busy} onClick={() => setConfirm(null)}>
            Abbrechen
          </button>
        </div>
        {error && <p className="message error">{error}</p>}
      </div>
    );
  }

  return (
    <>
      {incoming.length > 0 && (
        <div className="card tn-box tn-incoming">
          <p className="tn-box-title">{incoming.length === 1 ? "Team-Anfrage für dich" : "Team-Anfragen für dich"}</p>
          {incoming.map((r) => (
            <div key={r.id} className="tn-request">
              <Wreath level={r.from.level} rank={r.from.rank} size="2.4rem" />
              <span className="tn-request-name">
                <b>{r.from.name}</b> will mit dir spielen
              </span>
              <span className="tn-request-actions">
                <button type="button" className="tn-btn primary small" disabled={busy} onClick={() => setConfirm({ kind: "accept", pick: r.from, requestId: r.id })}>
                  Annehmen
                </button>
                <button type="button" className="linkish" disabled={busy} onClick={() => act({ action: "decline", requestId: r.id })}>
                  Ablehnen
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {outgoing ? (
        <div className="card tn-box">
          <p className="tn-box-title">Deine Anfrage</p>
          <div className="tn-request">
            <Wreath level={outgoing.to.level} rank={outgoing.to.rank} size="2.4rem" />
            <span className="tn-request-name">
              Wartet auf <b>{outgoing.to.name}</b> …
            </span>
            <span className="tn-request-actions">
              <button type="button" className="linkish" disabled={busy} onClick={() => act({ action: "withdraw" })}>
                Zurückziehen
              </button>
            </span>
          </div>
          <p className="small muted">Solange {outgoing.to.name} nicht angenommen hat, kannst du zurückziehen und jemand anderen fragen.</p>
        </div>
      ) : (
        <div className="tn-pick">
          <p className="dbl-prompt">Wen möchtest du als Partner anfragen?</p>
          {candidates.length > 8 && (
            <input
              type="search"
              className="opp-search"
              placeholder="🔍 Spieler suchen …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Spieler suchen"
            />
          )}
          <div className="opp-grid" role="listbox" aria-label="Partner wählen">
            {shown.map((p) => {
              const note = NOTE[p.status];
              const off = p.status === "team" || p.status === "noaccount";
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  aria-disabled={off}
                  disabled={off}
                  className={`opp${off ? " tn-off" : ""}${p.status === "asked" ? " tn-asked" : ""}`}
                  onClick={() =>
                    setConfirm(p.status === "asked" ? { kind: "accept", pick: p, requestId: p.requestId } : { kind: "invite", pick: p })
                  }
                >
                  <Wreath level={p.level} rank={p.rank} size="3rem" />
                  <span className="opp-name">{p.name}</span>
                  {p.cohort && <span className="opp-cohort">({p.cohort})</span>}
                  {note && <span className="tn-note">{note}</span>}
                </button>
              );
            })}
            {shown.length === 0 && <p className="empty small">Niemand gefunden.</p>}
          </div>
          <p className="small muted tn-hint">Anmeldung bis {deadline}. Die Person muss deine Anfrage annehmen – danach ist das Team fest.</p>
        </div>
      )}
      {error && <p className="message error">{error}</p>}
    </>
  );
}
