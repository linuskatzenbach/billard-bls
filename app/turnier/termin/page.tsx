import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { getDraw, getResults, getSchedule, getTeams } from "@/lib/tournament";
import { KO_LABEL, koBracket } from "@/lib/tournament-draw";
import TerminForm from "./TerminForm";

// Termin einer K.O.-Serie eintragen: /turnier/termin?ko=vf1
export default async function TerminPage({ searchParams }: { searchParams: Promise<{ ko?: string }> }) {
  await connection();
  const { ko } = await searchParams;
  const session = await getSession();
  const [{ ov }, teams, draw, results, schedule] = await Promise.all([
    getOverview(),
    getTeams(),
    getDraw(),
    getResults(),
    getSchedule(),
  ]);
  const back = (
    <Link href="/turnier" className="back-link">
      ← Turnier
    </Link>
  );
  const fail = (msg: string) => (
    <>
      {back}
      <h1>Termin</h1>
      <p className="empty">{msg}</p>
    </>
  );

  if (!session) return fail("Bitte zuerst anmelden.");
  const s = draw?.published ? koBracket(draw.groups, results).find((x) => x.id === ko) : undefined;
  if (!s || s.teams[0] === null || s.teams[1] === null) return fail("Diese Partie steht noch nicht fest.");
  if (s.winner !== null) return fail("Diese Serie ist schon entschieden.");
  const pair = s.teams.map((id) => teams.find((t) => t.id === id)!);
  const four = pair.flatMap((t) => [t.player1, t.player2]);
  if (!four.includes(session.playerId) && !session.admin) return fail("Den Termin können nur die vier Spieler dieser Partie eintragen.");

  const name = (id: string) => ov.byId[id]?.name ?? id;
  const teamName = (i: number) => `${name(pair[i].player1)} & ${name(pair[i].player2)}`;
  const nr = s.id.replace(/\D/g, "");
  const current = schedule.find((x) => x.series === s.id) ?? null;

  return (
    <>
      {back}
      <h1>Termin</h1>
      <p className="subtitle">
        {KO_LABEL[s.round]}
        {nr && ` ${nr}`} · {s.round === "f" ? "Best of 5" : "Best of 3"}
      </p>
      <p className="tm-pair">
        {teamName(0)} <i>vs.</i> {teamName(1)}
      </p>
      <TerminForm ko={s.id} day={current?.day ?? ""} time={current?.time ?? ""} place={current?.place ?? ""} />
    </>
  );
}
