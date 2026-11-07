// 2v2-Turnier: Anfragen, Annehmen (fest), gleichzeitige Klicks, Anmeldeschluss.
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
process.env.LOCAL_PGLITE_DIR = mkdtempSync(join(tmpdir(), "billard-turnier-"));

const t = await import("../lib/tournament.ts");
const { getSql } = await import("../lib/sql.ts");
const before = new Date("2026-11-08T12:00:00Z");
const after = new Date("2026-11-13T23:30:00Z"); // = 14.11., 00:30 deutscher Zeit

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "OK" : "FEHLER"} – ${label}`);
  if (!ok) failed++;
};
const rejects = async (p: Promise<unknown>, label: string) => {
  try {
    await p;
    check(false, label);
  } catch (err) {
    check(err instanceof t.TournamentError, `${label} (${(err as Error).message})`);
  }
};

check(t.TOURNAMENT.deadline === "2026-11-13T22:59:59.000Z", `Anmeldeschluss Fr 13.11. 23:59:59 (${t.TOURNAMENT.deadline})`);
check(t.registrationOpen(before) && !t.registrationOpen(after), "Anmeldung offen bis Freitag, danach zu");

// Linus fragt Julian an; zweite Anfrage gleichzeitig geht nicht.
const r1 = await t.sendRequest("linus", "julian", before);
await rejects(t.sendRequest("linus", "jannik", before), "nur eine offene Anfrage");
await rejects(t.sendRequest("julian", "linus", before), "Gegenanfrage wird abgefangen");
await rejects(t.sendRequest("linus", "linus", before), "sich selbst anfragen geht nicht");
check((await t.countIncomingRequests("julian")) >= 0, "Zähler für roten Punkt läuft");

// Zurückziehen und neu fragen.
await t.withdrawRequest("linus", before);
const r2 = await t.sendRequest("linus", "jannik", before);
await rejects(t.acceptRequest(r1.id, "julian", before), "zurückgezogene Anfrage kann nicht angenommen werden");

// Jemand anderes fragt Jannik ebenfalls an; Jannik nimmt Linus an.
const r3 = await t.sendRequest("julian", "jannik", before);
const team = await t.acceptRequest(r2.id, "jannik", before);
check(team.player1 === "linus" && team.player2 === "jannik", "Team Linus & Jannik steht");
const open = await t.getOpenRequests("jannik");
check(open.incoming.length === 0, "andere Anfragen an Jannik verfallen");
await rejects(t.acceptRequest(r3.id, "jannik", before), "verfallene Anfrage nicht annehmbar");
await rejects(t.sendRequest("julian", "linus", before), "wer im Team ist, kann nicht angefragt werden");
await rejects(t.withdrawRequest("linus", before), "festes Team: nichts mehr zurückzuziehen");

// Gleichzeitig annehmen: A fragt B, C fragt B – B nimmt beides fast gleichzeitig an.
const sql = getSql();
const players = (await sql`SELECT id FROM players WHERE id NOT IN ('linus', 'jannik', 'julian') ORDER BY id LIMIT 3`).map((r) => r.id as string);
if (players.length === 3) {
  const [a, b, c] = players;
  const ra = await t.sendRequest(a, b, before);
  const rc = await t.sendRequest(c, b, before);
  const res = await Promise.allSettled([t.acceptRequest(ra.id, b, before), t.acceptRequest(rc.id, b, before)]);
  check(res.filter((r) => r.status === "fulfilled").length === 1, "gleichzeitiges Annehmen: genau ein Team");
}
const teams = await t.getTeams();
const members = teams.flatMap((x) => [x.player1, x.player2]);
check(new Set(members).size === members.length, "niemand ist in zwei Teams");

// Nach Anmeldeschluss geht nichts mehr.
await rejects(t.sendRequest("julian", players[0] ?? "x", after), "nach Anmeldeschluss keine Anfragen mehr");
check((await t.countIncomingRequests("julian")) === 0 || t.registrationOpen(), "kein roter Punkt nach Anmeldeschluss");

process.exit(failed === 0 ? 0 : 1);
