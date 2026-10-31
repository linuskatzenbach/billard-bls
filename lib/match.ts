import type { MatchRow } from "./db";

// Ein Spiel aus Sicht der einzelnen Beteiligten. Einzel: 2 Plätze,
// Doppel: 4 Plätze (jeweils mit Partner und den beiden Gegnern).

export type Seat = {
  id: string;
  won: boolean;
  before: number;
  after: number;
  partner: string | null;
  opps: string[];
};

export const isDoubles = (m: MatchRow): boolean => Boolean(m.winner2_id && m.loser2_id);

export function seats(m: MatchRow): Seat[] {
  if (!isDoubles(m)) {
    return [
      { id: m.winner_id, won: true, before: m.winner_elo_before, after: m.winner_elo_after, partner: null, opps: [m.loser_id] },
      { id: m.loser_id, won: false, before: m.loser_elo_before, after: m.loser_elo_after, partner: null, opps: [m.winner_id] },
    ];
  }
  const W = [m.winner_id, m.winner2_id!];
  const L = [m.loser_id, m.loser2_id!];
  return [
    { id: W[0], won: true, before: m.winner_elo_before, after: m.winner_elo_after, partner: W[1], opps: L },
    { id: W[1], won: true, before: m.winner2_elo_before!, after: m.winner2_elo_after!, partner: W[0], opps: L },
    { id: L[0], won: false, before: m.loser_elo_before, after: m.loser_elo_after, partner: L[1], opps: W },
    { id: L[1], won: false, before: m.loser2_elo_before!, after: m.loser2_elo_after!, partner: L[0], opps: W },
  ];
}

export const seatOf = (m: MatchRow, id: string): Seat | null => seats(m).find((s) => s.id === id) ?? null;
export const playerIdsOf = (m: MatchRow): string[] => seats(m).map((s) => s.id);
export const involves = (m: MatchRow, id: string): boolean =>
  m.winner_id === id || m.loser_id === id || m.winner2_id === id || m.loser2_id === id;

// Elo vor dem Spiel: im Einzel die beiden Spieler, im Doppel der Schnitt der Teams.
export function sidesBefore(m: MatchRow): { win: number; lose: number } {
  if (!isDoubles(m)) return { win: m.winner_elo_before, lose: m.loser_elo_before };
  return {
    win: (m.winner_elo_before + m.winner2_elo_before!) / 2,
    lose: (m.loser_elo_before + m.loser2_elo_before!) / 2,
  };
}

// Wie viel Elo die Verlierer (bzw. ihr Team) vorher mehr hatten.
export const underdogGap = (m: MatchRow): number => {
  const s = sidesBefore(m);
  return Math.round(s.lose - s.win);
};
