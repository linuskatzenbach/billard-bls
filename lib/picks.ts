import type { Overview } from "./progress";

export type Pick = { id: string; name: string; rank: number | null; level: number };

// Auswahl für "Spiel eintragen": erst die Rangliste, dann die Neuen.
export function picksFor(ov: Overview, myId: string): { me: Pick | null; opponents: Pick[] } {
  const toPick = (s: Overview["visible"][number]): Pick => ({ id: s.id, name: s.name, rank: s.rank, level: s.level });
  const me = ov.byId[myId] ? toPick(ov.byId[myId]) : null;
  const opponents = [...ov.ranked, ...[...ov.provisional].sort((a, b) => a.name.localeCompare(b.name, "de"))]
    .filter((s) => s.id !== myId)
    .map(toPick);
  return { me, opponents };
}
