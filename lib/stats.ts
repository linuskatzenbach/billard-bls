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

// Eine Zeile im Top-3-Leaderboard einer Statistik. Gleichstand → mehrere
// Spieler in einer Zeile; der nächste Rang wird übersprungen (1, 1, 3).
export type RankRow = {
  rank: number;
  playerIds: string[];
  value: number;
};

// Eine Zeile der Formtabelle: die letzten 10 Spiele eines Spielers.
export type FormRow = {
  rank: number;
  playerId: string;
  results: boolean[]; // true = Sieg; älteste zuerst, neuestes Spiel zuletzt
  wins: number;
  eloSum: number; // Summe der Elo-Gewinne/-Verluste dieser Spiele
};

export const FORM_GAMES = 10;

export type Stats = {
  mostGames: StatEntry | null;
  bestWinRate: StatEntry | null; // value in Prozent (gerundet)
  longestAtTop: StatEntry | null; // value in Tagen (mit Nachkommastellen)
  mostDaysAtTop: StatEntry | null; // value = Tage, an deren Ende man Platz 1 war
  longestStreak: StatEntry | null; // value = Siege in Folge
  highestElo: StatEntry | null; // value = Elo-Höchststand
  form: FormRow[];
  top: {
    mostGames: RankRow[];
    bestWinRate: RankRow[];
    longestAtTop: RankRow[];
    mostDaysAtTop: RankRow[];
    longestStreak: RankRow[];
    highestElo: RankRow[];
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

// Kalendertag nach deutscher Zeit als "YYYY-MM-DD" (sortier- und rechenbar).
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayKey = (d: Date) => dayKeyFormatter.format(d);

// Anzahl Kalendertage von a bis b (b − a), beide als "YYYY-MM-DD".
function daysBetween(a: string, b: string): number {
  const ms = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / DAY_MS);
}

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
  const daysAtTopTotal: Record<string, number> = {};
  const recent: Record<string, { won: boolean; delta: number }[]> = {};
  for (const id of visible) {
    games[id] = 0;
    wins[id] = 0;
    elo[id] = START_ELO;
    msAtTop[id] = 0;
    streak[id] = 0;
    maxStreak[id] = 0;
    daysAtTopTotal[id] = 0;
    recent[id] = [];
  }

  // Platz 1 = alle sichtbaren Spieler mit der aktuell höchsten Elo.
  // Bei Gleichstand an der Spitze teilen sich mehrere Spieler Platz 1.
  // Gezählt wird nur die längste ununterbrochene Phase auf Platz 1:
  // Wer Platz 1 verliert, fängt beim nächsten Mal wieder bei null an.
  const currentLeaders = (): string[] => {
    const top = Math.max(...visible.map((id) => elo[id]));
    return visible.filter((id) => elo[id] === top);
  };

  let leaders = new Set<string>();
  const topSince: Record<string, number> = {};
  const closeRun = (id: string, end: number) => {
    msAtTop[id] = Math.max(msAtTop[id], end - topSince[id]);
  };
  // "Meiste Tage auf Platz 1": Geschaut wird jeweils am Tagesende (deutsche
  // Zeit), wer auf Platz 1 steht; diese Tage werden einfach addiert – egal
  // ob zusammenhängend oder nicht. Auch Tage ohne Spiel zählen (der Stand
  // vom Vortag gilt weiter). Der laufende Tag zählt erst, wenn er vorbei ist.
  // Wer noch kein Spiel hat, steht dafür nicht auf Platz 1.
  const dayEndLeaders = (): string[] => {
    const played = visible.filter((id) => games[id] > 0);
    if (played.length === 0) return [];
    const top = Math.max(...played.map((id) => elo[id]));
    return played.filter((id) => elo[id] === top);
  };
  const creditDays = (n: number) => {
    if (n <= 0) return;
    for (const id of dayEndLeaders()) daysAtTopTotal[id] += n;
  };
  let lastDay: string | null = null;

  for (const m of matches) {
    const t = new Date(m.created_at).getTime();

    // Neuer Tag → alle abgeschlossenen Tage seit dem letzten Spiel gutschreiben.
    const day = dayKey(new Date(m.created_at));
    if (lastDay && day !== lastDay) creditDays(daysBetween(lastDay, day));
    lastDay = day;

    for (const [id, after, won] of [
      [m.winner_id, m.winner_elo_after, true],
      [m.loser_id, m.loser_elo_after, false],
    ] as const) {
      if (!visibleSet.has(id)) continue;
      games[id] += 1;
      const before = id === m.winner_id ? m.winner_elo_before : m.loser_elo_before;
      recent[id].push({ won, delta: after - before });
      if (recent[id].length > FORM_GAMES) recent[id].shift();
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

    const next = new Set(currentLeaders());
    for (const id of leaders) if (!next.has(id)) closeRun(id, t);
    for (const id of next) if (!leaders.has(id)) topSince[id] = t;
    leaders = next;
  }

  for (const id of leaders) closeRun(id, now.getTime());
  if (lastDay) creditDays(daysBetween(lastDay, dayKey(now)));

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

  // Formtabelle: Platz 1 hat die meisten Siege in den letzten 10 Spielen,
  // bei Gleichstand entscheidet die Elo-Summe dieser Spiele. Ist auch die
  // gleich, teilen sich die Spieler den Platz.
  const formRaw = visible
    .filter((id) => recent[id].length > 0)
    .map((id) => ({
      playerId: id,
      results: recent[id].map((r) => r.won),
      wins: recent[id].filter((r) => r.won).length,
      eloSum: recent[id].reduce((sum, r) => sum + r.delta, 0),
    }))
    .sort((a, b) => b.wins - a.wins || b.eloSum - a.eloSum);
  const form: FormRow[] = [];
  formRaw.forEach((r, i) => {
    const prev = form[form.length - 1];
    const tied = prev && prev.wins === r.wins && prev.eloSum === r.eloSum;
    form.push({ ...r, rank: tied ? prev.rank : i + 1 });
  });

  return {
    mostGames: best(games),
    bestWinRate: best(winRates),
    longestAtTop: best(daysAtTop),
    mostDaysAtTop: best(daysAtTopTotal),
    longestStreak: best(maxStreak),
    highestElo: best(peakElo),
    form,
    top: {
      mostGames: ranking(games),
      bestWinRate: ranking(winRates),
      longestAtTop: ranking(daysAtTop),
      mostDaysAtTop: ranking(daysAtTopTotal),
      longestStreak: ranking(maxStreak),
      highestElo: ranking(peakElo),
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
