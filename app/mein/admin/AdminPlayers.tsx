"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type P = { id: string; name: string; email: string; hidden: boolean; games: number; founder: boolean };

function Row({ p }: { p: P }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(p.name);
  const [email, setEmail] = useState(p.email);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(fields: Partial<{ name: string; email: string; hidden: boolean }>) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, ...fields }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      setMsg(data.error ?? "Hat nicht geklappt.");
      return;
    }
    setMsg("Gespeichert ✓");
    router.refresh();
  }

  return (
    <div className={`ap-row${p.hidden ? " hidden" : ""}`}>
      <button type="button" className="ap-head" onClick={() => setOpen((v) => !v)}>
        <span className="ap-name">
          {p.name}
          {p.founder && <span className="ap-tag">Gründer</span>}
          {p.hidden && <span className="ap-tag">ausgeblendet</span>}
        </span>
        <span className="ap-meta">{p.email ? "✓ Mail" : <span className="warn">keine Mail</span>} · {p.games} Spiele</span>
      </button>
      {open && (
        <div className="ap-edit">
          <label>
            Anzeigename
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          </label>
          <label>
            Uni-Mail
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vorname.nachname@law-school.de"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <div className="ap-actions">
            <button type="button" disabled={busy} onClick={() => save({ name, email })}>
              Speichern
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => save({ hidden: !p.hidden })}>
              {p.hidden ? "Wieder einblenden" : "Ausblenden"}
            </button>
          </div>
          <span className="ap-id">ID: {p.id}</span>
          {msg && <p className={`message ${msg.includes("✓") ? "success" : "error"}`}>{msg}</p>}
        </div>
      )}
    </div>
  );
}

export default function AdminPlayers({ players }: { players: P[] }) {
  const [q, setQ] = useState("");
  const shown = q ? players.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase())) : players;
  return (
    <div className="ap">
      {players.length > 8 && (
        <input className="opp-search" placeholder="🔍 Spieler suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {shown.map((p) => (
        <Row key={p.id} p={p} />
      ))}
    </div>
  );
}
