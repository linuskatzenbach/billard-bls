// Viele Spiele + Widersprüche gleichzeitig; danach muss jede gespeicherte Elo
// exakt einer Neuberechnung aller Spiele von vorn entsprechen.
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
process.env.LOCAL_PGLITE_DIR = mkdtempSync(join(tmpdir(), "billard-stress-"));

const { recordMatch, disputeMatch } = await import("../lib/db.ts");
const { getSql } = await import("../lib/sql.ts");
const { eloDelta, START_ELO } = await import("../lib/elo.ts");
const sql = getSql();

const P = ["linus", "julian", "jannik", "benedikt", "philip", "tobias"];
const pick = (n: number) => [...P].sort(() => Math.random() - 0.5).slice(0, n);
const randomMatch = () => {
  if (Math.random() < 0.4) { const [a, b, c, d] = pick(4); return { winnerIds: [a, b], loserIds: [c, d], enteredBy: a }; }
  const [a, b] = pick(2); return { winnerIds: [a], loserIds: [b], enteredBy: a };
};

// Runde 1: Grundbestand
const first = await Promise.all(Array.from({ length: 12 }, () => recordMatch(randomMatch())));
// Runde 2: neue Spiele und Widersprüche gegen ältere Spiele gleichzeitig
await Promise.all([
  ...Array.from({ length: 12 }, () => recordMatch(randomMatch())),
  disputeMatch(first[2].id, "julian"),
  disputeMatch(first[7].id, "linus"),
]);

// Kontrolle: alles von vorn nachrechnen
const matches = await sql`SELECT * FROM matches ORDER BY created_at, id`;
const elo: Record<string, number> = {};
const cur = (id: string) => elo[id] ?? START_ELO;
let bad = 0;
for (const m of matches) {
  const W = [m.winner_id, m.winner2_id].filter(Boolean);
  const L = [m.loser_id, m.loser2_id].filter(Boolean);
  const avg = (xs: string[]) => xs.reduce((n, id) => n + cur(id), 0) / xs.length;
  if (m.winner_elo_before !== cur(m.winner_id) || m.loser_elo_before !== cur(m.loser_id)) bad++;
  const d = eloDelta(avg(W), avg(L));
  for (const id of W) elo[id] = cur(id) + d.win;
  for (const id of L) elo[id] = cur(id) + d.lose;
}
const stored = await sql`SELECT id, elo FROM player_elo`;
for (const r of stored) if (Number(r.elo) !== cur(r.id)) { bad++; console.log("abweichend:", r.id, r.elo, "≠", cur(r.id)); }
console.log(`${bad === 0 ? "OK" : "FEHLER"} – ${matches.length} Spiele (26 eingetragen, 2 widersprochen), Abweichungen: ${bad}`);
process.exit(bad === 0 && matches.length === 22 ? 0 : 1);
