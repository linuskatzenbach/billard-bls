import Link from "next/link";
import { getLeaderboard, getRecentMatches } from "@/lib/db";
import { getPlayerName } from "@/lib/players";

export const dynamic = "force-dynamic";

function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
  });
}

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

      {matches.length > 0
