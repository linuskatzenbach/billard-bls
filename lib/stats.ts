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

export type Stats = {
  mostGames: StatEntry | null;
  bestWinRate: StatEntry | null; // value in Prozent (gerundet)
  longestAtTop: StatEntry | null; // value in Tagen (mit Nachkommastellen)
  longestStreak: StatEntry | null; // value = Siege in Folge
  highestElo: StatEntry | null; // value = Elo-Höchststand
  matchDayRecord: MatchDayRecord | null;
};

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

    // Spieltag-Rekord zählt alle Spiele, auch die ausgeblendeter Spieler.
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

  return {
    mostGames: best(games),
    bestWinRate: best(winRates),
    longestAtTop: best(daysAtTop),
    longestStreak: best(maxStreak),
    highestElo: best(peakElo),
    matchDayRecord,
  };
}
