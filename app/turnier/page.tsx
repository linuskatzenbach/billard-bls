import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { picksFor, type Pick } from "@/lib/picks";
import { dayKey } from "@/lib/time";
import { seats } from "@/lib/match";
import { TOURNAMENT, getDraw, getOpenRequests, getResults, getSchedule, getTeams, registrationOpen } from "@/lib/tournament";
import { Bracket, GroupCards, Rules, SpecialRules } from "./TournamentView";
import { GROUPS, KO_LABEL, RELEGATION, koBracket, splitResults, terminText } from "@/lib/tournament-draw";
import Wreath from "../Wreath";
import TeamActions, { type Candidate } from "./TeamActions";
import Notice from "./Notice";
import { TOURNAMENT_NOTICE } from "@/lib/tournament-notice";

// 2v2-Turnier: Ablauf, eigene Team-Anfragen und alle angemeldeten Teams.
export default async function TurnierPage() {
  await connection();
  const session = await getSession();
  const open = registrationOpen();
  const [{ world, ov }, teams, requests, draw, pairResults, schedule] = await Promise.all([
    getOverview(),
    getTeams(),
    session ? getOpenRequests(session.playerId) : Promise.resolve(null),
    getDraw(),
    getResults(),
    getSchedule(),
  ]);
  const drawn = draw?.published ? draw : null;
  const split = splitResults(pairResults);

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

  // mailto an die Gegner (Partner in CC) – nur für eigene Paarungen.
  const mailTo = (a: number, b: number, stage: string, when: string): string | null => {
    if (!session || !drawn) return null;
    const ta = teams.find((t) => t.id === a);
    const tb = teams.find((t) => t.id === b);
    if (!ta || !tb) return null;
    const me = session.playerId;
    const mineT = [ta.player1, ta.player2].includes(me) ? ta : [tb.player1, tb.player2].includes(me) ? tb : null;
    if (!mineT) return null;
    const other = mineT === ta ? tb : ta;
    const partner = mineT.player1 === me ? mineT.player2 : mineT.player1;
    const mailOf = (id: string) => world.players.find((p) => p.id === id)?.email ?? null;
    const to = [mailOf(other.player1), mailOf(other.player2)].filter(Boolean).join(",");
    if (!to) return null;
    const cc = mailOf(partner);
    const name = (id: string) => toPick(id).name;
    const subject = `Billard BLS Turnier – ${stage}: ${name(mineT.player1)} & ${name(mineT.player2)} vs. ${name(other.player1)} & ${name(other.player2)}`;
    const body = `Moin ${name(other.player1)} und ${name(other.player2)},\n\nwir spielen ${when} gegeneinander. Wann passt es euch?\n\nVorschlag: \n\nViele Grüße\n${name(me)}`;
    const q = [cc ? `cc=${encodeURIComponent(cc)}` : "", `subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].filter(Boolean).join("&");
    return `mailto:${to}?${q}`;
  };
  const involved = (a: number | null, b: number | null) => {
    if (!session || a === null || b === null) return false;
    return teams.some((t) => (t.id === a || t.id === b) && (t.player1 === session.playerId || t.player2 === session.playerId));
  };
  const ko = drawn ? koBracket(drawn.groups, pairResults) : null;
  const termOf = (id: string) => schedule.find((t) => t.series === id) ?? null;
  const teamText = (id: number | null) => {
    const t = teams.find((x) => x.id === id);
    return t ? `${toPick(t.player1).name} & ${toPick(t.player2).name}` : "–";
  };
  const upcoming = (ko ?? [])
    .filter((x) => x.winner === null && x.teams[0] !== null && x.teams[1] !== null && termOf(x.id))
    .map((x) => ({ x, t: termOf(x.id)! }))
    .sort((p, q) => `${p.t.day} ${p.t.time}`.localeCompare(`${q.t.day} ${q.t.time}`));
  const termine = (
    <>
      <div className="section-h">
        <h2>Termine</h2>
        <span>zum Zuschauen</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="empty small">Noch keine Termine – die Teams tragen sie über das Kalender-Symbol im Baum ein.</p>
      ) : (
        <ul className="tm-list">
          {upcoming.map(({ x, t }) => {
            const nr = x.id.replace(/\D/g, "");
            const isMine = myTeam ? x.teams.includes(myTeam.id) : false;
            return (
              <li key={x.id} className={isMine ? "mine" : undefined}>
                <span className="tm-when">{terminText(t.day, t.time)}</span>
                <span className="tm-what">
                  <span className="tm-round">
                    {KO_LABEL[x.round]}
                    {nr && ` ${nr}`}
                    {x.wins[0] + x.wins[1] > 0 && ` · Stand ${x.wins[0]}:${x.wins[1]}`}
                    {t.place && ` · ${t.place}`}
                  </span>
                  <span>
                    {teamText(x.teams[0])} <i>vs.</i> {teamText(x.teams[1])}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
  // Steht das Viertelfinale komplett, rückt der Baum nach oben.
  const koReady = !!ko && ko.filter((x) => x.round === "vf").every((x) => x.teams[0] !== null && x.teams[1] !== null);
  const bracket = ko && (
    <>
      <div className="section-h">
        <h2>{koReady ? "K.O.-Runde" : "Turnierbaum"}</h2>
        <span>Sieger gegen Zweiten</span>
      </div>
      <Bracket
        series={ko}
        mine={myTeam?.id ?? null}
        label={(id) => {
          const t = teams.find((x) => x.id === id);
          if (!t) return "–";
          const a = toPick(t.player1);
          const b = toPick(t.player2);
          return (
            <>
              <span><Link href={`/spieler/${a.id}`}>{a.name}</Link> &</span>
              <span><Link href={`/spieler/${b.id}`}>{b.name}</Link></span>
            </>
          );
        }}
        enterHref={(x) => (involved(x.teams[0], x.teams[1]) ? `/turnier/eintragen?ko=${x.id}` : null)}
        termin={(x) => {
          const t = termOf(x.id);
          return t ? terminText(t.day, t.time) : null;
        }}
        terminHref={(x) => (involved(x.teams[0], x.teams[1]) || session?.admin ? `/turnier/termin?ko=${x.id}` : null)}
        mailHref={(x) =>
          x.teams[0] !== null && x.teams[1] !== null
            ? mailTo(x.teams[0], x.teams[1], KO_LABEL[x.round], `im ${KO_LABEL[x.round]} (${x.round === "f" ? "Best of 5" : "Best of 3"})`)
            : null
        }
      />
    </>
  );

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
          {today <= TOURNAMENT_NOTICE.until && <Notice id={TOURNAMENT_NOTICE.id} text={TOURNAMENT_NOTICE.text} />}
          <SpecialRules />

          {koReady && bracket}
          {koReady && termine}

          <div className="section-h">
            <h2>Gruppen</h2>
            <span>Best of 1 · beste 2 kommen weiter</span>
          </div>
          <GroupCards
            groups={drawn.groups}
            label={(id) => {
              const t = teams.find((x) => x.id === id);
              if (!t) return "–";
              const a = toPick(t.player1);
              const b = toPick(t.player2);
              return (
                <>
                  <Link href={`/spieler/${a.id}`}>{a.name}</Link> & <Link href={`/spieler/${b.id}`}>{b.name}</Link>
                </>
              );
            }}
            eloOf={(id) => {
              // Aktueller Elo-Schnitt des Teams (nicht der Stand zum Anmeldeschluss).
              const t = teams.find((x) => x.id === id);
              return t ? (toPick(t.player1).elo + toPick(t.player2).elo) / 2 : 0;
            }}
            mine={myTeam?.id ?? null}
            showGroupAvg={false}
            results={split.group}
            relResults={split.rel}
            mailHref={(a, b, rel) => {
              const g = GROUPS[drawn.groups.findIndex((x) => x.includes(a))] ?? "";
              return rel
                ? mailTo(a, b, `Relegation Gruppe ${g}`, `in der Relegation (bis ${RELEGATION.deadlineLabel})`)
                : mailTo(a, b, `Gruppe ${g}`, "in der Gruppenphase");
            }}
            enterHref={(a, b, rel) => {
              if (!session) return null;
              const ta = teams.find((t) => t.id === a);
              const tb = teams.find((t) => t.id === b);
              const four = [ta?.player1, ta?.player2, tb?.player1, tb?.player2];
              return four.includes(session.playerId) ? `/turnier/eintragen?a=${a}&b=${b}${rel ? `&rel=${rel}` : ""}` : null;
            }}
          />

          {!koReady && bracket}

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
        Die Turnierspiele zählen ganz normal für Elo, Wochenzocker und Abzeichen. {drawn ? "" : "Gruppen und Spielplan kommen nach Anmeldeschluss."}
      </p>
    </>
  );
}
