import Link from "next/link";
import { getLeaderboard, getRecentMatches } from "@/lib/db";
import { getPlayerName } from "@/lib/players";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const leaderboard = await getLeaderboard();
  const matches = await getRecentMatches(10);

  return (
    <>
      <h1>Billard-Rangliste</h1>
      <p className="subtitle">Elo-Wertung unserer Runde</p>

      {leaderboard.length === 0 ? (
        <p className="empty">Noch keine Spieler eingetragen.</p>
      ) : (
        <div className="leaderboard">
          {leaderboard.map((entry, index) => (
            <div className="row" key={entry.id}>
              <span className={`rank ${index === 0 ? "gold" : ""}`}>
                {index + 1}
              </span>
              <span className="name">{getPlayerName(entry.id)}</span>
              <span className="elo">{entry.elo}</span>
            </div>
          ))}
        </div>
      )}

      <Link href="/eintragen" className="nav-link">
        Ergebnis eintragen →
      </Link>

      {matches.length > 0 && (
        <div className="history">
          <h2>Letzte Spiele</h2>
          {matches.map((m, i) => (
            <div className="history-row" key={i}>
              <span>
                {getPlayerName(m.winner_id)} schlägt {getPlayerName(m.loser_id)}
              </span>
              <span className="delta win">
                +{m.winner_elo_after - m.winner_elo_before} /{" "}
                {m.loser_elo_after - m.loser_elo_before}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
