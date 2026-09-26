import Link from "next/link";
import { notFound } from "next/navigation";
import { PLAYERS, getPlayerName } from "@/lib/players";
import { getLeaderboard, getMatchesForPlayer } from "@/lib/db";
import { START_ELO } from "@/lib/elo";

export const dynamic = "force-dynamic";

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = PLAYERS.find((p) => p.id === id);

  if (!player) {
    notFound();
  }

  const [matches, leaderboard] = await Promise.all([
    getMatchesForPlayer(id),
    getLeaderboard(),
  ]);

  const wins = matches.filter((m) => m.won).length;
  const losses = matches.length - wins;

  const rankIndex = leaderboard.findIndex((e) => e.id === id);
  const currentElo = rankIndex >= 0 ? leaderboard[rankIndex].elo : START_ELO;
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  // Elo-Verlauf: Start-Elo, dann Elo nach jedem Spiel in chronologischer Reihenfolge.
  const eloHistory = [START_ELO, ...matches.map((m) => m.elo_after)];
  const highestElo = Math.max(...eloHistory);
  const lowestElo = Math.min(...eloHistory);

  // Aufschlüsselung nach Gegner
  const opponentMap = new Map<string, { wins: number; losses: number }>();
  for (const m of matches) {
    const stat = opponentMap.get(m.opponent_id) ?? { wins: 0, losses: 0 };
    if (m.won) stat.wins += 1;
    else stat.losses += 1;
    opponentMap.set(m.opponent_id, stat);
  }
  const opponents = Array.from(opponentMap.entries())
    .map(([opponentId, stat]) => ({ opponentId, ...stat }))
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  // Punkte für das kleine SVG-Liniendiagramm berechnen.
  const chartWidth = 280;
  const chartHeight = 64;
  const range = highestElo - lowestElo;
  const points = eloHistory.map((elo, i) => {
    const x =
      eloHistory.length > 1
        ? (i / (eloHistory.length - 1)) * chartWidth
        : chartWidth / 2;
    const y =
      range > 0
        ? chartHeight - ((elo - lowestElo) / range) * chartHeight
        : chartHeight / 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lastX, lastY] = points[points.length - 1].split(",");

  return (
    <>
      <Link href="/" className="back-link">
        ← Rangliste
      </Link>

      <h1>{player.name}</h1>
      <p className="subtitle">
        Elo {currentElo}
        {rank ? ` · Rang #${rank}` : ""}
      </p>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-value">{matches.length}</span>
          <span className="stat-label">Spiele</span>
        </div>
        <div className="stat">
          <span className="stat-value">{wins}</span>
          <span className="stat-label">Siege</span>
        </div>
        <div className="stat">
          <span className="stat-value">{losses}</span>
          <span className="stat-label">Niederlagen</span>
        </div>
        <div className="stat">
          <span className="stat-value">{highestElo}</span>
          <span className="stat-label">Höchste Elo</span>
        </div>
      </div>

      {matches.length > 0 && (
        <div className="chart-wrap">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="elo-chart"
            preserveAspectRatio="none"
          >
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={lastX} cy={lastY} r="3" fill="currentColor" />
          </svg>
        </div>
      )}

      {opponents.length > 0 && (
        <div className="opponents">
          <h2>Gegen einzelne Gegner</h2>
          {opponents.map((o) => (
            <div className="opponent-row" key={o.opponentId}>
              <span className="opponent-name">{getPlayerName(o.opponentId)}</span>
              <span className="opponent-record">
                <span className="rec-win">{o.wins} S</span>
                <span className="rec-sep">–</span>
                <span className="rec-loss">{o.losses} N</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {matches.length === 0 && (
        <p className="empty">Noch keine Spiele gespielt.</p>
      )}

      {matches.length > 0 && (
        <div className="history">
          <h2>Letzte Spiele</h2>
          {matches
            .slice()
            .reverse()
            .slice(0, 10)
            .map((m, i) => (
              <div className="match-line" key={i}>
                <span className="opponent-name">
                  {m.won ? "Sieg gegen " : "Niederlage gegen "}
                  {getPlayerName(m.opponent_id)}
                </span>
                <span className={`delta ${m.won ? "win" : "loss"}`}>
                  {m.won ? "▲" : "▼"}
                  {Math.abs(m.elo_after - m.elo_before)}
                </span>
                <span className="match-date-inline">{formatMatchDate(m.created_at)}</span>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
