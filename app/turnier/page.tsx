import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { picksFor, type Pick } from "@/lib/picks";
import { dayKey } from "@/lib/time";
import { TOURNAMENT, getOpenRequests, getTeams, registrationOpen } from "@/lib/tournament";
import Wreath from "../Wreath";
import TeamActions from "./TeamActions";

// 2v2-Turnier: Ablauf, eigene Team-Anfragen und alle angemeldeten Teams.
export default async function TurnierPage() {
  await connection();
  const session = await getSession();
  const open = registrationOpen();
  const [{ world, ov }, teams, requests] = await Promise.all([
    getOverview(),
    getTeams(),
    session ? getOpenRequests(session.playerId) : Promise.resolve(null),
  ]);

  const toPick = (id: string): Pick => {
    const s = ov.byId[id];
    return s
      ? { id, name: s.name, rank: s.rank, level: s.level, cohort: s.cohort, elo: s.elo }
      : { id, name: id, rank: null, level: 0, cohort: null, elo: 1500 };
  };
  const inTeam = new Set(teams.flatMap((t) => [t.player1, t.player2]));
  const myTeam = session ? teams.find((t) => t.player1 === session.playerId || t.player2 === session.playerId) : undefined;

  // Anfragen gehen nur an Spieler mit Konto (sonst können sie nicht annehmen).
  const withAccount = new Set(world.players.filter((p) => p.email && !p.hidden).map((p) => p.id));
  const candidates = session
    ? picksFor(ov, session.playerId).opponents.filter(
        // Wer dich schon angefragt hat, steht oben bei den Anfragen.
        (p) => withAccount.has(p.id) && !inTeam.has(p.id) && !requests?.incoming.some((r) => r.from === p.id)
      )
    : [];

  const today = dayKey(new Date());
  const current = TOURNAMENT.phases.find((p) => today <= p.until)?.key ?? null;

  return (
    <>
      <h1>{TOURNAMENT.name}</h1>
      <p className="subtitle">
        {open ? <>Such dir einen Partner – Anmeldung bis {TOURNAMENT.deadlineLabel}.</> : <>Die Anmeldung ist geschlossen, die Teams stehen fest.</>}
      </p>

      <ol className="tn-phases">
        {TOURNAMENT.phases.map((p) => (
          <li key={p.key} className={`tn-phase${p.key === current ? " now" : ""}${current && p.until < today ? " done" : ""}`}>
            <span className="tn-phase-label">{p.label}</span>
            <span className="tn-phase-when">{p.when}</span>
          </li>
        ))}
      </ol>

      {!session && open && (
        <div className="card login-needed">
          <p>Melde dich an, um dich mit einem Partner anzumelden.</p>
          <Link href="/profil" className="bigbtn">
            Anmelden
          </Link>
        </div>
      )}

      {session && myTeam && (
        <div className="card tn-mine">
          <p className="tn-mine-title">Du bist dabei! 🎱</p>
          <p>
            Dein Partner: <b>{toPick(myTeam.player1 === session.playerId ? myTeam.player2 : myTeam.player1).name}</b>
          </p>
          <p className="small muted">Euer Team steht fest und kann nicht mehr geändert werden.</p>
        </div>
      )}

      {session && !myTeam && open && requests && (
        <TeamActions
          incoming={requests.incoming.map((r) => ({ id: r.id, from: toPick(r.from) }))}
          outgoing={requests.outgoing ? { id: requests.outgoing.id, to: toPick(requests.outgoing.to) } : null}
          candidates={candidates}
          deadline={TOURNAMENT.deadlineLabel}
        />
      )}

      {session && !myTeam && !open && (
        <p className="empty small">Du bist bei diesem Turnier nicht dabei – zuschauen und anfeuern geht trotzdem.</p>
      )}

      <div className="section-h">
        <h2>{open ? "Angemeldete Teams" : "Die Teams"}</h2>
        <span>{teams.length === 1 ? "1 Team" : `${teams.length} Teams`}</span>
      </div>
      {teams.length === 0 ? (
        <p className="empty small">Noch keine Teams – meldet euch als Erste an!</p>
      ) : (
        <ul className="tn-teams">
          {teams.map((t, i) => {
            const a = toPick(t.player1);
            const b = toPick(t.player2);
            const mine = myTeam?.id === t.id;
            return (
              <li key={t.id} className={`tn-team${mine ? " mine" : ""}`}>
                <span className="tn-team-no">{i + 1}</span>
                <span className="tn-team-balls">
                  <Wreath level={a.level} rank={a.rank} size="2rem" />
                  <Wreath level={b.level} rank={b.rank} size="2rem" />
                </span>
                <span className="tn-team-names">
                  <span>
                    <Link href={`/spieler/${a.id}`}>{a.name}</Link> & <Link href={`/spieler/${b.id}`}>{b.name}</Link>
                  </span>
                  <span className="tn-team-cohort">
                    {[a.cohort, b.cohort].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="tn-team-avg">Ø {Math.round((a.elo + b.elo) / 2)}</span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="tn-foot small muted">
        Die Turnierspiele zählen ganz normal für Elo, Wochenzocker und Abzeichen. Gruppen und Spielplan kommen nach Anmeldeschluss.
      </p>
    </>
  );
}
