import { randomInt } from "crypto";
import type { MatchRow } from "./db";
import { seats } from "./match";
import { START_ELO } from "./elo";

// Auslosung und Turnierbaum für das 2v2-Turnier (16 Teams).
//
// Setzliste: Team-Elo = Schnitt der beiden Spieler, eingefroren zum
// Anmeldeschluss (Spiele danach zählen nicht). Daraus 4 Töpfe à 4 Teams.
// Topf 1 wird gesetzt (Nr. 1 → A, Nr. 2 → B, Nr. 3 → C, Nr. 4 → D), aus
// den Töpfen 2–4 bekommt jede Gruppe ein zufälliges Team.
//
// Viertelfinale: Gruppensieger gegen Zweiten einer anderen Gruppe. Teams
// aus derselben Gruppe stehen in verschiedenen Hälften (Wiedersehen
// frühestens im Finale), ebenso die Gruppen der Nr. 1 und Nr. 2.

export const GROUPS = ["A", "B", "C", "D"] as const;
export type GroupKey = (typeof GROUPS)[number];
export const TEAM_COUNT = 16;
export const GROUP_SIZE = 4;

export type SeedTeam = { teamId: number; players: [string, string]; elo: number; seed: number; pot: number };

// Elo eines Spielers zu einem Zeitpunkt: Stand nach seinem letzten Spiel bis dahin.
export function eloAt(matches: MatchRow[], playerId: string, cutoffIso: string): number {
  const cut = new Date(cutoffIso).getTime();
  let elo = START_ELO;
  for (const m of matches) {
    if (new Date(m.created_at).getTime() > cut) continue;
    const s = seats(m).find((x) => x.id === playerId);
    if (s) elo = s.after;
  }
  return elo;
}

// Setzliste: höchste Team-Elo zuerst; bei Gleichstand das früher angemeldete Team.
export function seedTeams(
  teams: { id: number; player1: string; player2: string }[],
  eloOf: (playerId: string) => number,
): SeedTeam[] {
  return teams
    .map((t, i) => ({ t, i, elo: (eloOf(t.player1) + eloOf(t.player2)) / 2 }))
    .sort((a, b) => b.elo - a.elo || a.i - b.i)
    .map(({ t, elo }, k) => ({
      teamId: t.id,
      players: [t.player1, t.player2] as [string, string],
      elo,
      seed: k + 1,
      pot: Math.floor(k / GROUP_SIZE) + 1,
    }));
}

function shuffle<T>(xs: T[], rand: (n: number) => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Gruppen: je Gruppe 4 Team-IDs in Topf-Reihenfolge (Position 1 = Topf 1).
export function drawGroups(seeded: SeedTeam[], rand: (n: number) => number = (n) => randomInt(n)): number[][] {
  if (seeded.length !== TEAM_COUNT) throw new Error(`Für die Auslosung braucht es genau ${TEAM_COUNT} Teams (gerade ${seeded.length}).`);
  const groups: number[][] = GROUPS.map(() => []);
  for (let pot = 1; pot <= GROUP_SIZE; pot++) {
    const inPot = seeded.filter((s) => s.pot === pot).sort((a, b) => a.seed - b.seed);
    const order = pot === 1 ? inPot : shuffle(inPot, rand);
    order.forEach((s, g) => groups[g].push(s.teamId));
  }
  return groups;
}

// Spielplan einer Gruppe (Positionen 1–4): drei Runden, jeder spielt einmal gegen jeden.
// Das Duell der beiden Stärksten (1 gegen 2) kommt zum Schluss.
export const GROUP_ROUNDS: [number, number][][] = [
  [[1, 4], [2, 3]],
  [[1, 3], [4, 2]],
  [[1, 2], [3, 4]],
];

export type Slot = { group: GroupKey; place: 1 | 2 };
// Viertelfinale in Baum-Reihenfolge: VF1 + VF2 → HF1, VF3 + VF4 → HF2.
export const QUARTERS: [Slot, Slot][] = [
  [{ group: "A", place: 1 }, { group: "C", place: 2 }],
  [{ group: "D", place: 1 }, { group: "B", place: 2 }],
  [{ group: "B", place: 1 }, { group: "D", place: 2 }],
  [{ group: "C", place: 1 }, { group: "A", place: 2 }],
];

export const FORMAT = {
  groups: "1 Spiel",
  quarter: "Best of 3",
  semi: "Best of 3",
  final: "Best of 5",
} as const;

export const TIEBREAK = ["Punkte (Siege − Niederlagen)", "Direkter Vergleich"] as const;

// ---------------------------------------------------------------------------
// Tabelle einer Gruppe. Reihenfolge: Punkte (Siege minus Niederlagen), dann
// direkter Vergleich unter den Punktgleichen. So steht ein Team mit 0:0 vor
// einem mit 0:1, solange noch nicht alle gleich viele Spiele haben.
//
// Relegation: Bei einem Dreiergleichstand im Kreis (jeder hat unter den
// dreien genau einen Sieg) und fertig gespielter Gruppe spielen die drei noch
// einmal jeder gegen jeden (Runde 1, je ein Spiel). Entsteht wieder ein Kreis,
// folgt Runde 2 usw. Die Reihenfolge der drei ergibt sich aus den Siegen der
// entscheidenden Runde. Relegationsspiele sind normale Turnierspiele.

export type GroupResult = { a: number; b: number; winner: number };
export type RelResult = GroupResult & { round: number };
export type StandingRow = { teamId: number; played: number; wins: number; losses: number };
// teams: die drei Teams (Tabellen-Reihenfolge vor der Relegation), round: die
// laufende bzw. entscheidende Runde, done: entschieden.
export type RelegationInfo = { teams: number[]; round: number; done: boolean; pairs: [number, number][] };

export const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
export const RELEGATION = { deadlineLabel: "Mi 25.11.", deadline: "2026-11-25" } as const;
// Ergebnis-Schlüssel eines Relegationsspiels, z. B. "rel1:12-17" (Runde 1).
export const relKey = (round: number, a: number, b: number) => `rel${round}:${pairKey(a, b)}`;
export function parseRelKey(key: string): { round: number; a: number; b: number } | null {
  const m = /^rel(\d+):(\d+)-(\d+)$/.exec(key);
  return m ? { round: Number(m[1]), a: Number(m[2]), b: Number(m[3]) } : null;
}

// Gespeicherte Ergebnisse aufteilen in Gruppenspiele und Relegationsspiele.
export function splitResults(results: { key: string; winnerTeam: number }[]): { group: GroupResult[]; rel: RelResult[] } {
  const group: GroupResult[] = [];
  const rel: RelResult[] = [];
  for (const r of results) {
    const rk = parseRelKey(r.key);
    if (rk) {
      rel.push({ ...rk, winner: r.winnerTeam });
      continue;
    }
    const [a, b] = r.key.split("-").map(Number);
    if (Number.isInteger(a) && Number.isInteger(b) && r.key === pairKey(a, b)) group.push({ a, b, winner: r.winnerTeam });
  }
  return { group, rel };
}

export function groupStandings(
  ids: number[],
  results: GroupResult[],
  relResults: RelResult[] = [],
): { rows: StandingRow[]; relegation: number[] | null; rel: RelegationInfo | null } {
  const inGroup = results.filter((r) => ids.includes(r.a) && ids.includes(r.b));
  const rows = ids.map((teamId) => {
    const mine = inGroup.filter((r) => r.a === teamId || r.b === teamId);
    const wins = mine.filter((r) => r.winner === teamId).length;
    return { teamId, played: mine.length, wins, losses: mine.length - wins };
  });
  const seedPos = (id: number) => ids.indexOf(id);
  const miniWins = (id: number, tied: number[]) =>
    inGroup.filter((r) => r.winner === id && tied.includes(r.a) && tied.includes(r.b)).length;
  const complete = inGroup.length === (ids.length * (ids.length - 1)) / 2;
  let rel: RelegationInfo | null = null;

  const sorted: StandingRow[] = [];
  const points = (r: StandingRow) => r.wins - r.losses;
  const byPoints = [...new Set(rows.map(points))].sort((x, y) => y - x);
  for (const p of byPoints) {
    const tied = rows.filter((r) => points(r) === p).map((r) => r.teamId);
    tied.sort((x, y) => miniWins(y, tied) - miniWins(x, tied) || seedPos(x) - seedPos(y));
    if (complete && tied.length === 3 && tied.every((id) => miniWins(id, tied) === 1)) {
      rel = relegationOf(tied, relResults);
      if (rel.done) {
        const w = (id: number) =>
          relResults.filter((r) => r.round === rel!.round && r.winner === id && tied.includes(r.a) && tied.includes(r.b)).length;
        tied.sort((x, y) => w(y) - w(x));
      }
    }
    for (const id of tied) sorted.push(rows.find((r) => r.teamId === id)!);
  }
  return { rows: sorted, relegation: rel && !rel.done ? rel.teams : null, rel };
}

// Stand der Relegation unter drei Teams: erste Runde, die noch offen ist oder
// keinen Kreis ergibt.
function relegationOf(teams: number[], relResults: RelResult[]): RelegationInfo {
  const pairs: [number, number][] = [
    [teams[0], teams[1]],
    [teams[1], teams[2]],
    [teams[0], teams[2]],
  ];
  for (let round = 1; ; round++) {
    const games = relResults.filter((r) => r.round === round && teams.includes(r.a) && teams.includes(r.b));
    const played = pairs.filter(([x, y]) => games.some((g) => pairKey(g.a, g.b) === pairKey(x, y)));
    if (played.length < 3) return { teams, round, done: false, pairs };
    const circle = teams.every((id) => games.filter((g) => g.winner === id).length === 1);
    if (!circle) return { teams, round, done: true, pairs };
  }
}

// ---------------------------------------------------------------------------
// K.O.-Runde: Ergebnis-Schlüssel je Einzelspiel einer Serie, z. B. "vf1:1"
// (Viertelfinale 1, Spiel 1), "hf2:3", "f:4". Gruppenspiele haben "12-17".
// Nötige Siege für das Weiterkommen je Serie (Best of 3 / Best of 5).
export const KO_ROUNDS = ["vf", "hf", "f"] as const;
export type KoRound = (typeof KO_ROUNDS)[number];
export const KO_WINS: Record<KoRound, number> = { vf: 2, hf: 2, f: 3 };
export const koKey = (round: KoRound, series: number | null, game: number) => `${round}${series ?? ""}:${game}`;
export function parseKoKey(key: string): { round: KoRound; series: string } | null {
  const m = /^(vf|hf|f)(\d*):\d+$/.exec(key);
  return m ? { round: m[1] as KoRound, series: `${m[1]}${m[2]}` } : null;
}
