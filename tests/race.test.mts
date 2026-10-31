// Prüft, dass gleichzeitig eingetragene Spiele keine Elo verschlucken.
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
process.env.LOCAL_PGLITE_DIR = mkdtempSync(join(tmpdir(), "billard-race-"));

const { recordMatch, getWorld } = await import("../lib/db.ts");
const { getSql } = await import("../lib/sql.ts");

// Zwei Spiele mit demselben Spieler (linus) praktisch zeitgleich eintragen.
const [a, b] = await Promise.all([
  recordMatch({ winnerIds: ["linus"], loserIds: ["julian"], enteredBy: "linus" }),
  recordMatch({ winnerIds: ["linus"], loserIds: ["jannik"], enteredBy: "linus" }),
]);
const rows = await getSql()`SELECT elo FROM player_elo WHERE id = 'linus'`;
const stored = Number(rows[0].elo);
const second = [a, b].sort((x, y) => x.id - y.id)[1];
console.log("Spiel 1:", a.winner_elo_before, "→", a.winner_elo_after);
console.log("Spiel 2:", b.winner_elo_before, "→", b.winner_elo_after);
console.log("gespeichert:", stored);
const ok = second.winner_elo_before !== 1500 && stored === second.winner_elo_after;
console.log(ok ? "OK – beide Siege zählen" : "FEHLER – ein Sieg ist verloren gegangen");
process.exit(ok ? 0 : 1);
