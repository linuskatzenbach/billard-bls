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

export const TIEBREAK = ["Siege", "Direkter Vergleich", "Relegation"] as const;
