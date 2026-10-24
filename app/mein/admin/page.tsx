import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDisputes } from "@/lib/db";
import { berlinDateTime, getOverview } from "@/lib/server";
import { mailConfigured } from "@/lib/mail";
import AdminPlayers from "./AdminPlayers";
import MarkDisputesSeen from "./MarkDisputesSeen";

export default async function AdminPage() {
  await connection();
  const session = await getSession();
  if (!session?.admin) redirect("/mein");
  const [{ world, ov, nameOf }, disputes] = await Promise.all([getOverview(), getDisputes()]);
  const unseen = disputes.some((d) => !d.seen);

  const players = world.players.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email ?? "",
    hidden: p.hidden,
    games: ov.byId[p.id]?.games ?? 0,
    founder: p.founder,
  }));

  return (
    <>
      <Link href="/mein" className="back-link">
        ← Mein Profil
      </Link>
      <h1>Admin-Bereich</h1>
      <p className="subtitle">
        {world.players.length} Spieler · {world.matches.length} Spiele
      </p>
      {!mailConfigured() && (
        <p className="message error">
          Mail-Versand ist noch nicht eingerichtet (GMAIL_USER / GMAIL_APP_PASSWORD fehlen in Vercel). Anmeldelinks
          werden nicht verschickt.
        </p>
      )}

      <MarkDisputesSeen needed={unseen} />
      <div className="section-h">
        <h2>Widersprüche</h2>
        <span>gelöschte Spiele</span>
      </div>
      {disputes.length === 0 ? (
        <p className="empty small">Noch keine.</p>
      ) : (
        <div className="card disputes">
          {disputes.map((d) => (
            <div className={`dispute-row${d.seen ? "" : " new"}`} key={d.id}>
              <div>
                <b>{nameOf(d.winner_id)}</b> schlägt <b>{nameOf(d.loser_id)}</b>
              </div>
              <div className="muted small">
                eingetragen von {d.entered_by ? nameOf(d.entered_by) : "–"} am {berlinDateTime(d.played_at)}
              </div>
              <div className="small">
                {d.disputed_by === d.entered_by ? "selbst gelöscht" : `widersprochen von ${nameOf(d.disputed_by)}`} am{" "}
                {berlinDateTime(d.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-h">
        <h2>Spieler</h2>
        <span>Name, Uni-Mail, sichtbar</span>
      </div>
      <p className="hint-left">
        Trag hier die Uni-Mails deiner Freunde ein – wer sich dann mit dieser Adresse anmeldet, übernimmt seinen
        bestehenden Spieler.
      </p>
      <AdminPlayers players={players} />

      <Link href="/mein/test" className="cta cta-test">
        <span className="cta-felt">
          <span className="cta-label">Testspiel eintragen</span>
        </span>
      </Link>
      <p className="me-note">Testspiele laufen mit der kompletten Animation, werden aber nicht gespeichert.</p>
    </>
  );
}
