import type { MatchRecord } from "./db";
import { PLAYERS } from "./players";
import { START_ELO } from "./elo";

// Wer weniger Spiele hat, zählt bei der Siegesquote nicht mit –
// sonst führt jemand mit 1 Spiel und 1 Sieg dauerhaft mit 100 %.
export const MIN_GAMES_FOR_WIN_RATE = 5;

// Spieltage werden nach deutscher Zeit gezählt (ein Abend nach Mitternacht
// zählt also zum nächsten Tag).
const TIME_ZONE = "Europe/Berlin";

export type StatEntry = {
  playerIds: string[]; // mehrere bei Gleichstand
  value: number;
};

export type MatchDayRecord = {
  date: string; // z.B. "7.10.2026"
  count: number;
};

// Eine Zeile im Top-3-Leaderboard einer Statistik. Gleichstand → mehrere
// Spieler in einer Zeile; der nächste Rang wird übersprungen (1, 1, 3).
export type RankRow = {
  rank: number;
  playerIds: string[];
  value: number;
};

export type DayRankRow = {
  rank: number;
  date: string;
  count: number;
};

export type Stats = {
  mostGames: StatEntry | null;
  bestWinRate: StatEntry | null; // value in Prozent (gerundet)
  longestAtTop: StatEntry | null; // value in Tagen (mit Nachkommastellen)
  longestStreak: StatEntry | null; // value = Siege in Folge
  highestElo: StatEntry | null; // value = Elo-Höchststand
  matchDayRecord: MatchDayRecord | null;
  top: {
    mostGames: RankRow[];
    bestWinRate: RankRow[];
    longestAtTop: RankRow[];
    longestStreak: RankRow[];
    highestElo: RankRow[];
    matchDays: DayRankRow[];
  };
};

const TOP_N = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// Ermittelt alle Spieler mit dem höchsten Wert (Gleichstand → mehrere).
function best(values: Record<string, number>): StatEntry | null {
  let top = -Infinity;
  let ids: string[] = [];
  for (const [id, v] of Object.entries(values)) {
    if (v > top) {
      top = v;
      ids = [id];
    } else if (v === top) {
      ids.push(id);
    }
  }
  if (ids.length === 0 || top <= 0) return null;
  return { playerIds: ids, value: top };
}

// Top-3-Rangliste: gleiche Werte teilen sich einen Rang und eine Zeile.
function ranking(values: Record<string, number>): RankRow[] {
  const sorted = Object.entries(values)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const rows: RankRow[] = [];
  let placed = 0;
  for (const [id, v] of sorted) {
    const last = rows[rows.length - 1];
    if (last && last.value === v) {
      last.playerIds.push(id);
    } else {
      const rank = placed + 1;
      if (rank > TOP_N) break;
      rows.push({ rank, playerIds: [id], value: v });
    }
    placed += 1;
  }
  return rows;
}

const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

// Erwartet die Spiele chronologisch sortiert (älteste zuerst).
export function computeStats(matches: MatchRecord[], now = new Date()): Stats {
  const visible = PLAYERS.filter((p) => !p.hidden).map((p) => p.id);
  const visibleSet = new Set(visible);

  const games: Record<string, number> = {};
  const wins: Record<string, number> = {};
  const elo: Record<string, number> = {};
  const msAtTop: Record<string, number> = {};
  const streak: Record<string, number> = {};
  const maxStreak: Record<string, number> = {};
  const peakElo: Record<string, number> = {};
  for (const id of visible) {
    games[id] = 0;
    wins[id] = 0;
    elo[id] = START_ELO;
    msAtTop[id] = 0;
    streak[id] = 0;
    maxStreak[id] = 0;
  }

  // Platz 1 = alle sichtbaren Spieler mit der aktuell höchsten Elo.
  // Bei Gleichstand an der Spitze teilen sich mehrere Spieler Platz 1
  // und bekommen die Zeit alle gutgeschrieben.
  const currentLeaders = (): string[] => {
    const top = Math.max(...visible.map((id) => elo[id]));
    return visible.filter((id) => elo[id] === top);
  };

  let leaders: string[] = [];
  let leadersSince = 0;
  const perDay = new Map<string, number>();

  for (const m of matches) {
    const t = new Date(m.created_at).getTime();

    for (const id of leaders) msAtTop[id] += t - leadersSince;

    // "Größter Zocktag" zählt alle Spiele, auch die ausgeblendeter Spieler.
    const day = dayFormatter.format(new Date(m.created_at));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);

    for (const [id, after, won] of [
      [m.winner_id, m.winner_elo_after, true],
      [m.loser_id, m.loser_elo_after, false],
    ] as const) {
      if (!visibleSet.has(id)) continue;
      games[id] += 1;
      elo[id] = after;
      peakElo[id] = Math.max(peakElo[id] ?? -Infinity, after);
      if (won) {
        wins[id] += 1;
        streak[id] += 1;
        maxStreak[id] = Math.max(maxStreak[id], streak[id]);
      } else {
        streak[id] = 0;
      }
    }

    leaders = currentLeaders();
    leadersSince = t;
  }

  for (const id of leaders) msAtTop[id] += now.getTime() - leadersSince;

  const winRates: Record<string, number> = {};
  for (const id of visible) {
    if (games[id] >= MIN_GAMES_FOR_WIN_RATE) {
      winRates[id] = Math.round((wins[id] / games[id]) * 100);
    }
  }

  const daysAtTop: Record<string, number> = {};
  for (const id of visible) {
    daysAtTop[id] = msAtTop[id] / DAY_MS;
  }

  // Bei gleich vielen Spielen an mehreren Tagen gewinnt der jüngste Tag
  // (Map behält die chronologische Reihenfolge, daher ">=").
  let matchDayRecord: MatchDayRecord | null = null;
  for (const [date, count] of perDay) {
    if (!matchDayRecord || count >= matchDayRecord.count) {
      matchDayRecord = { date, count };
    }
  }

  // Top 3 Spieltage; bei Gleichstand steht der jüngere Tag weiter oben.
  const days = [...perDay].reverse().sort((a, b) => b[1] - a[1]);
  const matchDays: DayRankRow[] = [];
  days.forEach(([date, count], i) => {
    if (i >= TOP_N) return;
    const prev = matchDays[matchDays.length - 1];
    const rank = prev && prev.count === count ? prev.rank : i + 1;
    matchDays.push({ rank, date, count });
  });

  return {
    mostGames: best(games),
    bestWinRate: best(winRates),
    longestAtTop: best(daysAtTop),
    longestStreak: best(maxStreak),
    highestElo: best(peakElo),
    matchDayRecord,
    top: {
      mostGames: ranking(games),
      bestWinRate: ranking(winRates),
      longestAtTop: ranking(daysAtTop),
      longestStreak: ranking(maxStreak),
      highestElo: ranking(peakElo),
      matchDays,
    },
  };
}

// Elo-Veränderung der letzten Tage je Spieler: aktuelle Elo minus Elo vor
// dem ersten Spiel im Zeitraum. Wer im Zeitraum nicht gespielt hat: 0.
export function eloTrend(
  matches: MatchRecord[],
  currentElo: Record<string, number>,
  days = 7,
  now = new Date()
): Record<string, number> {
  const cutoff = now.getTime() - days * DAY_MS;
  const before: Record<string, number> = {};
  for (const m of matches) {
    if (new Date(m.created_at).getTime() < cutoff) continue;
    if (!(m.winner_id in before)) before[m.winner_id] = m.winner_elo_before;
    if (!(m.loser_id in before)) before[m.loser_id] = m.loser_elo_before;
  }
  const trend: Record<string, number> = {};
  for (const [id, elo] of Object.entries(currentElo)) {
    trend[id] = id in before ? elo - before[id] : 0;
  }
  return trend;
}

// "heute", "gestern" oder "8.10." – nach deutscher Zeit.
export function formatRelativeDay(iso: string, now = new Date()): string {
  const key = (d: Date) => dayFormatter.format(d);
  const date = new Date(iso);
  if (key(date) === key(now)) return "heute";
  if (key(date) === key(new Date(now.getTime() - DAY_MS))) return "gestern";
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${day}.${month}.`;
}
