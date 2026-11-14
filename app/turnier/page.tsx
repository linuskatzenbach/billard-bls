import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { picksFor, type Pick } from "@/lib/picks";
import { dayKey } from "@/lib/time";
import { seats } from "@/lib/match";
import { TOURNAMENT, getDraw, getOpenRequests, getTeams, registrationOpen } from "@/lib/tournament";
import { Bracket, GroupCards, Rules } from "./TournamentView";
import Wreath from "../Wreath";
import TeamActions, { type Candidate } from "./TeamActions";

// 2v2-Turnier: Ablauf, eigene Team-Anfragen und alle angemeldeten Teams.
export default async function TurnierPage() {
  await connection();
  const session = await getSession();
  const open = registrationOpen();
  const [{ world, ov }, teams, requests, draw] = await Promise.all([
    getOverview(),
    getTeams(),
    session ? getOpenRequests(session.playerId) : Promise.resolve(null),
    getDraw(),
  ]);
  const drawn = draw?.published ? draw : null;

  const toPick = (id: string): Pick => {
    const s = ov.byId[id];
    return s
      ? { id, name: s.name, rank: s.rank, level: s.level, cohort: s.cohort, elo: s.elo }
      : { id, name: id, rank: null, level: 0, cohort: null, elo: 1500 };
  };
  const inTeam = new Set(teams.flatMap((t) => [t.player1, t.player2]));
  const myTeam = session ? teams.find((t) => t.player1 === session.playerId || t.player2 === session.playerId) : undefined;

  // Alle Spieler werden angezeigt. Anfragen gehen aber nur an Spieler mit
  // Konto (sonst können sie nicht annehmen) und ohne Team; wer dich schon
  // angefragt hat, kann direkt angenommen werden.
  const withAccount = new Set(world.players.filter((p) => p.email && !p.hidden).map((p) => p.id));
  const candidates: Candidate[] = session
    ? picksFor(ov, session.playerId).opponents.map((p) => {
        const asked = requests?.incoming.find((r) => r.from === p.id);
        if (inTeam.has(p.id)) return { ...p, status: "team" as const };
        if (asked) return { ...p, status: "asked" as const, requestId: asked.id };
        if (!withAccount.has(p.id)) return { ...p, status: "noaccount" as const };
        return { ...p, status: "free" as const };
      })
    : [];
  // Sortierung: zuerst die, gegen die man am meisten gespielt hat (Einzel und
  // Doppel). Wer gar nicht angefragt werden kann, steht am Ende. Bei
  // Gleichstand bleibt die Reihenfolge der Rangliste.
  if (session) {
    const vs = new Map<string, number>();
    for (const m of world.matches) {
      const mine = seats(m).find((x) => x.id === session.playerId);
      for (const o of mine?.opps ?? []) vs.set(o, (vs.get(o) ?? 0) + 1);
    }
    const off = (c: Candidate) => (c.status === "team" || c.status === "noaccount" ? 1 : 0);
    candidates.sort((a, b) => off(a) - off(b) || (vs.get(b.id) ?? 0) - (vs.get(a.id) ?? 0));
  }

  const today = dayKey(new Date());
  const current = TOURNAMENT.phases.find((p) => p.from <= today && today <= p.until)?.key ?? null;

  return (
    <>
      <h1>{TOURNAMENT.name}</h1>
      <p className="subtitle">
        {open ? <>Such dir einen Partner – Anmeldung bis {TOURNAMENT.deadlineLabel}.</> : <>Die Anmeldung ist geschlossen, die Teams stehen fest.</>}
      </p>

      {/* Ablauf als Zeitstrahl (nur Anzeige): jede Phase eine Kugel auf der Linie. */}
      <ol className="tn-road" aria-label="Ablauf">
        {TOURNAMENT.phases.map((p, i) => {
          const done = p.until < today;
          const now = p.key === current;
          return (
            <li key={p.key} className={`tn-step${now ? " now" : ""}${done ? " done" : ""}`} aria-current={now ? "step" : undefined}>
              <span className={`tn-ball b${i + 1}`} aria-hidden="true">
                <span>{done ? "✓" : i + 1}</span>
              </span>
              {now && <span className="tn-live">läuft</span>}
              <span className="tn-step-label">{p.label}</span>
              <span className="tn-step-detail">{p.detail}</span>
              <span className="tn-step-when">{p.when}</span>
            </li>
          );
        })}
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

      {drawn && (
        <>
          <div className="section-h">
            <h2>Gruppen</h2>
            <span>beste 2 kommen weiter</span>
          </div>
          <GroupCards
            groups={drawn.groups}
            label={(id) => {
              const t = teams.find((x) => x.id === id);
              return t ? `${toPick(t.player1).name} & ${toPick(t.player2).name}` : "–";
            }}
            eloOf={(id) => drawn.seeds.find((x) => x.teamId === id)?.elo ?? 0}
            mine={myTeam?.id ?? null}
          />

          <div className="section-h">
            <h2>Turnierbaum</h2>
            <span>Sieger gegen Zweiten</span>
          </div>
          <Bracket />

          <div className="section-h">
            <h2>Regeln</h2>
          </div>
          <Rules />
        </>
      )}

      {!drawn && (
      <>
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

      </>
      )}

      <p className="tn-foot small muted">
        Die Turnierspiele zählen ganz normal für Elo, Wochenzocker und Abzeichen. {drawn ? "Elo bei den Gruppen: Schnitt zum Anmeldeschluss." : "Gruppen und Spielplan kommen nach Anmeldeschluss."}
      </p>
    </>
  );
}
