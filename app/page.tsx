import Link from "next/link";
import {
  getLeaderboard,
  getRecentMatches,
  getCurrentStreaks,
  getAllMatches,
} from "@/lib/db";
import { computeStats, MIN_GAMES_FOR_WIN_RATE, type StatEntry } from "@/lib/stats";
import { getPlayerName, isPlayerHidden } from "@/lib/players";

export const dynamic = "force-dynamic";

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function names(entry: StatEntry): string {
  return entry.playerIds.map(getPlayerName).join(" & ");
}

function formatDays(days: number): string {
  if (days < 1) return "unter 1 Tag";
  const rounded = Math.round(days);
  return rounded === 1 ? "1 Tag" : `${rounded} Tage`;
}

export default async function HomePage() {
  const [leaderboard, matches, streaks, allMatches] = await Promise.all([
    getLeaderboard(),
    getRecentMatches(10),
    getCurrentStreaks(),
    getAllMatches(),
  ]);
  const stats = computeStats(allMatches);

  return (
    <>
      <h1>Billard-Rangliste</h1>
      <p className="subtitle">Jetzt wird gezockt!</p>

      {leaderboard.length === 0 ? (
        <p className="empty">Noch keine Spieler eingetragen.</p>
      ) : (
        <div className="leaderboard">
          {leaderboard.map((entry, index) => {
            const streak = streaks[entry.id] ?? 0;
            return (
              <Link
                href={`/spieler/${entry.id}`}
                className="row"
                key={entry.id}
              >
                <span className={`rank ${index === 0 ? "gold" : ""}`}>
                  {index + 1}
                </span>
                <span className="name">
                  {getPlayerName(entry.id)}
                  {streak >= 3 && <span className="streak"> 🔥{streak}</span>}
                </span>
                <span className="elo">{entry.elo}</span>
              </Link>
            );
          })}
        </div>
      )}

      <Link href="/eintragen" className="nav-link">
        Ergebnis eintragen →
      </Link>

      {matches.length > 0 && (
        <div className="history">
          <h2>Letzte Spiele</h2>
          {matches.map((m, i) => {
            const winnerGain = m.winner_elo_after - m.winner_elo_before;
            const loserLoss = m.loser_elo_after - m.loser_elo_before;
            const winnerHidden = isPlayerHidden(m.winner_id);
            const loserHidden = isPlayerHidden(m.loser_id);
            return (
              <div className="history-row" key={i}>
                <span className="player-name winner">{getPlayerName(m.winner_id)}</span>
                <span className="vs">vs</span>
                <span className="player-name loser">{getPlayerName(m.loser_id)}</span>

                <span className="player-meta winner">
                  {winnerHidden ? (
                    <span className="elo-before">???</span>
                  ) : (
                    <>
                      <span className="elo-before">{m.winner_elo_before}</span>
                      <span className="delta win">▲{Math.abs(winnerGain)}</span>
                    </>
                  )}
                </span>
                <span className="match-date">{formatMatchDate(m.created_at)}</span>
                <span className="player-meta loser">
                  {loserHidden ? (
                    <span className="elo-before">???</span>
                  ) : (
                    <>
                      <span className="delta loss">▼{Math.abs(loserLoss)}</span>
                      <span className="elo-before">{m.loser_elo_before}</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {allMatches.length > 0 && (
        <div className="stats">
          <h2>Statistiken</h2>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-label">Meiste Spiele</span>
              {stats.mostGames ? (
                <>
                  <span className="stat-name">{names(stats.mostGames)}</span>
                  <span className="stat-value">
                    {stats.mostGames.value} Spiele
                  </span>
                </>
              ) : (
                <span className="stat-value">–</span>
              )}
            </div>
            <div className="stat">
              <span className="stat-label">Höchste Siegesquote</span>
              {stats.bestWinRate ? (
                <>
                  <span className="stat-name">{names(stats.bestWinRate)}</span>
                  <span className="stat-value">
                    {stats.bestWinRate.value}% Siege
                  </span>
                </>
              ) : (
                <span className="stat-value">
                  ab {MIN_GAMES_FOR_WIN_RATE} Spielen
                </span>
              )}
            </div>
            <div className="stat">
              <span className="stat-label">Längste Zeit auf Platz 1</span>
              {stats.longestAtTop ? (
                <>
                  <span className="stat-name">{names(stats.longestAtTop)}</span>
                  <span className="stat-value">
                    {formatDays(stats.longestAtTop.value)}
                  </span>
                </>
              ) : (
                <span className="stat-value">–</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
