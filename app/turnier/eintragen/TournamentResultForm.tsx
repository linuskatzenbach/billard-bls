"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Ball, poolBall } from "../../RankBall";
import { showReward } from "../../RewardOverlay";
import type { Reward } from "@/lib/reward";
import type { Pick } from "@/lib/picks";
import type { VictoryResult, VictoryTableProps } from "../../VictoryTable";

const VictoryTable = dynamic(() => import("../../VictoryTable"), { ssr: false });

const ballOf = (p: Pick) => (p.rank ? poolBall(p.rank) : { color: "#f4efe4", kind: "cue" as const });
const initial = (p: Pick) => p.name.charAt(0).toUpperCase();

export type FormTeam = { id: number; players: [Pick, Pick] };

// Turnierspiel eintragen: die Paarung steht fest, nur das Siegerteam antippen.
export default function TournamentResultForm({ a, b }: { a: FormTeam; b: FormTeam }) {
  const router = useRouter();
  const [winner, setWinner] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [anim, setAnim] = useState<VictoryTableProps | null>(null);

  function start() {
    if (winner === null) return;
    setBusy(true);
    setError("");
    const result: Promise<VictoryResult & { reward: Reward | null }> = (async () => {
      let res: Response;
      try {
        res = await fetch("/api/turnier/ergebnis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ a: a.id, b: b.id, winner }),
        });
      } catch {
        throw new Error("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Etwas ist schiefgelaufen.");
      return { winnerDelta: data.winnerDelta ?? 0, loserDelta: data.loserDelta ?? 0, reward: (data.reward as Reward) ?? null };
    })();
    let reward: Reward | null = null;
    result.then((r) => (reward = r.reward)).catch(() => {});
    const player = (p: Pick) => ({ name: p.name, label: initial(p), ...ballOf(p) });
    const w = winner === a.id ? a : b;
    const l = winner === a.id ? b : a;
    setAnim({
      winners: w.players.map(player),
      losers: l.players.map(player),
      result,
      onDone: () => {
        if (reward) showReward(reward);
        router.push("/turnier");
        router.refresh();
      },
      onError: (message) => {
        setAnim(null);
        setBusy(false);
        setError(message);
      },
    });
  }

  const team = (t: FormTeam) => {
    const role = winner === null ? "" : winner === t.id ? "is-winner" : "is-loser";
    const [p, q] = t.players;
    return (
      <button type="button" className={`dbl-team ${role}`} onClick={() => setWinner(t.id)}>
        {role && <span className="picker-badge">{role === "is-winner" ? "Sieger" : "Verlierer"}</span>}
        <span className="dbl-team-balls">
          <Ball label={initial(p)} {...ballOf(p)} />
          <Ball label={initial(q)} {...ballOf(q)} />
        </span>
        <span className="dbl-team-name">
          {p.name} + {q.name}
        </span>
      </button>
    );
  };

  const w = winner === null ? null : winner === a.id ? a : b;
  const l = winner === null ? null : winner === a.id ? b : a;

  return (
    <div className="dbl">
      <p className="duel-title">Welches Team hat gewonnen?</p>
      <div className="dbl-teams">
        {team(a)}
        {team(b)}
      </div>
      {w && l && (
        <div className="dbl-summary">
          <p>
            <b>{w.players[0].name} und {w.players[1].name}</b> schlagen {l.players[0].name} und {l.players[1].name}
          </p>
        </div>
      )}
      <button type="button" className="dbl-save" disabled={winner === null || busy} onClick={start}>
        {busy ? "Speichert…" : "Ergebnis speichern"}
      </button>
      <p className="result-note">
        Zählt wie ein normales Doppel sofort für die Elo von allen vier. Die anderen können 24 h lang widersprechen –
        dann ist das Turnierspiel wieder offen.
      </p>
      {error && <p className="message error">{error}</p>}
      {anim && <VictoryTable {...anim} />}
    </div>
  );
}
