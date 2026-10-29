"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Ball, poolBall } from "./RankBall";
import Wreath from "./Wreath";
import type { Pick } from "@/lib/picks";
import type { VictoryResult, VictoryTableProps } from "./VictoryTable";

// 2 gegen 2 eintragen – vorerst nur im Admin-Testspiel (nichts wird gespeichert).
// Ablauf: Partner wählen, dann zwei Gegner, dann das Siegerteam antippen.

const VictoryTable = dynamic(() => import("./VictoryTable"), { ssr: false });

const ballOf = (p: Pick) => (p.rank ? poolBall(p.rank) : { color: "#f4efe4", kind: "cue" as const });
const initial = (p: Pick) => p.name.charAt(0).toUpperCase();

type Slot = 0 | 1 | 2; // Partner, Gegner 1, Gegner 2

export default function DoublesForm({ me, players, home }: { me: Pick; players: Pick[]; home: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<(string | null)[]>([null, null, null]);
  const [active, setActive] = useState<Slot>(0);
  const [weWon, setWeWon] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [anim, setAnim] = useState<VictoryTableProps | null>(null);
  const teamsRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);

  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const [partner, opp1, opp2] = picked.map(byId);
  const complete = Boolean(partner && opp1 && opp2);

  const q = query.trim().toLowerCase();
  const shown = q
    ? players.filter((p) => p.name.toLowerCase().includes(q) || (p.cohort ?? "").toLowerCase().includes(q))
    : players;

  function choose(id: string) {
    setError("");
    const next = [...picked];
    const already = next.indexOf(id);
    if (already === active) {
      next[active] = null; // nochmal antippen = abwählen
    } else {
      if (already >= 0) next[already] = null; // jeder nur einmal
      next[active] = id;
    }
    setPicked(next);
    setWeWon(null);
    // automatisch zum nächsten freien Platz
    const free = [0, 1, 2].find((i) => !next[i]);
    if (free !== undefined) setActive(free as Slot);
    else requestAnimationFrame(() => teamsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function resetTeams() {
    setPicked([null, null, null]);
    setActive(0);
    setWeWon(null);
    requestAnimationFrame(() => slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const avg = (a: Pick, b: Pick) => Math.round((a.elo + b.elo) / 2);

  async function start() {
    if (!partner || !opp1 || !opp2 || weWon === null) return;
    setBusy(true);
    setError("");
    const result: Promise<VictoryResult> = (async () => {
      let res: Response;
      try {
        res = await fetch("/api/test-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId: partner.id, opponentIds: [opp1.id, opp2.id], won: weWon }),
        });
      } catch {
        throw new Error("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Etwas ist schiefgelaufen.");
      return { winnerDelta: data.winnerDelta ?? 0, loserDelta: data.loserDelta ?? 0 };
    })();
    const player = (p: Pick) => ({ name: p.name, label: initial(p), ...ballOf(p) });
    const ours = [player(me), player(partner)];
    const theirs = [player(opp1), player(opp2)];
    setAnim({
      winners: weWon ? ours : theirs,
      losers: weWon ? theirs : ours,
      result,
      onDone: () => {
        router.push(home);
        router.refresh();
      },
      onError: (message) => {
        setAnim(null);
        setBusy(false);
        setError(message);
      },
    });
  }

  const slot = (p: Pick | null, i: Slot | null, label: string) => {
    const isMe = i === null;
    const on = !isMe && !complete && active === i;
    return (
      <button
        type="button"
        className={`dbl-slot${on ? " active" : ""}${p ? " filled" : ""}`}
        onClick={() => {
          if (isMe) return;
          // im fertigen Zustand: Platz leeren und neu wählen
          if (complete) {
            const next = [...picked];
            next[i] = null;
            setPicked(next);
            setWeWon(null);
          }
          setActive(i);
        }}
        disabled={isMe}
        aria-label={isMe ? "Ich" : `${label} wählen`}
      >
        {p ? <Wreath level={p.level} rank={p.rank} size="2.4rem" /> : <span className="dbl-empty">+</span>}
        <span className="dbl-slot-name">{isMe ? "Ich" : (p?.name ?? label)}</span>
      </button>
    );
  };

  const team = (a: Pick, b: Pick, mine: boolean) => {
    const role = weWon === null ? "" : weWon === mine ? "is-winner" : "is-loser";
    return (
      <button type="button" className={`dbl-team ${role}`} onClick={() => setWeWon(mine)}>
        {role && <span className="picker-badge">{role === "is-winner" ? "Sieger" : "Verlierer"}</span>}
        <span className="dbl-team-balls">
          <Ball label={initial(a)} {...ballOf(a)} />
          <Ball label={initial(b)} {...ballOf(b)} />
        </span>
        <span className="dbl-team-name">{mine ? `Ich + ${b.name}` : `${a.name} + ${b.name}`}</span>
        <span className="dbl-team-avg">Ø {avg(a, b)}</span>
      </button>
    );
  };

  const summary =
    weWon === null || !opp1 || !opp2
      ? ""
      : weWon
        ? <>Ihr schlagt <b>{opp1.name} und {opp2.name}</b></>
        : <><b>{opp1.name} und {opp2.name}</b> schlagen euch</>;

  return (
    <div className="dbl">
      <div className="dbl-labels">
        <span>Dein Team</span>
        <span>Gegner</span>
      </div>
      <div className="dbl-slots" ref={slotsRef}>
        {slot(me, null, "Ich")}
        {slot(partner, 0, "Partner")}
        <span className="dbl-vs">vs</span>
        {slot(opp1, 1, "Gegner")}
        {slot(opp2, 2, "Gegner")}
      </div>

      {!complete && (
        <>
          <p className="dbl-prompt">{active === 0 ? "Wer war dein Partner?" : "Gegen wen habt ihr gespielt?"}</p>
          {players.length > 8 && (
            <input
              type="search"
              className="opp-search"
              placeholder="🔍 Spieler suchen …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Spieler suchen"
            />
          )}
          <div className="opp-grid" role="listbox" aria-label="Spieler">
            {shown.map((p) => {
              const at = picked.indexOf(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={at >= 0}
                  className={`opp${at >= 0 ? " selected" : ""}`}
                  onClick={() => choose(p.id)}
                >
                  <Wreath level={p.level} rank={p.rank} size="3rem" />
                  <span className="opp-name">{p.name}</span>
                  {p.cohort && <span className="opp-cohort">({p.cohort})</span>}
                </button>
              );
            })}
            {shown.length === 0 && <p className="empty small">Niemand gefunden.</p>}
          </div>
        </>
      )}

      {complete && partner && opp1 && opp2 && (
        <div className="dbl-result" ref={teamsRef}>
          <p className="duel-title">Welches Team hat gewonnen?</p>
          <div className="dbl-teams">
            {team(me, partner, true)}
            {team(opp1, opp2, false)}
          </div>
          <div className="dbl-summary">
            {summary && <p>{summary}</p>}
            <button type="button" className="dbl-change" onClick={resetTeams}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.5 4.5l5 5L9 20H4v-5z" />
              </svg>
              Teams ändern
            </button>
          </div>
        </div>
      )}

      <button type="button" className="dbl-save" disabled={!complete || weWon === null || busy} onClick={start}>
        {busy ? "Läuft…" : "Testspiel starten"}
      </button>
      {error && <p className="message error">{error}</p>}

      {anim && <VictoryTable {...anim} />}
    </div>
  );
}
