// Datenbank-Einrichtung: beim ersten Start voll, danach nur noch eine
// Versionsprüfung (alte Einmal-Korrekturen laufen nicht erneut).
// Läuft als zwei getrennte Prozesse – wie zwei Kaltstarts auf Vercel.
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";

const [, , step, dirArg] = process.argv;
const dir = dirArg ?? mkdtempSync(join(tmpdir(), "billard-setup-"));
process.env.LOCAL_PGLITE_DIR = dir;

const { getSql } = await import("../lib/sql.ts");
const { getPlayerById } = await import("../lib/db.ts");
const sql = getSql();
const close = async () => (await (globalThis as any).__billardPglite)?.close();

if (step === "zweiter-start") {
  await getPlayerById("linus");
  const julian = await sql`SELECT hidden FROM players WHERE id = 'julian'`;
  await close();
  process.exit(julian[0].hidden === true ? 0 : 1);
}

// Erster Start: volle Einrichtung
await getPlayerById("linus");
const players = await sql`SELECT count(*)::int AS n FROM players`;
// Merker einer alten Korrektur entfernen. Liefe die volle Einrichtung beim
// nächsten Start erneut, würde Julian wieder sichtbar geschaltet.
await sql`DELETE FROM migrations WHERE name = 'unhide-julian'`;
await sql`UPDATE players SET hidden = true WHERE id = 'julian'`;
await close();

let second = true;
try {
  execFileSync(process.execPath, [...process.execArgv, process.argv[1], "zweiter-start", dir], { stdio: "ignore", timeout: 60_000 });
} catch {
  second = false;
}
const ok = players[0].n > 0 && second;
console.log(ok ? "OK – zweiter Start nur Versionsprüfung" : "FEHLER – Einrichtung beim zweiten Start falsch");
process.exit(ok ? 0 : 1);
