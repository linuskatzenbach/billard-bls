// Auslosung: Töpfe, gesetzter Topf 1, jede Gruppe ein Team pro Topf, Turnierbaum.
const d = await import("../lib/tournament-draw.ts");

let failed = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "OK" : "FEHLER"} – ${label}`);
  if (!ok) failed++;
};

const teams = Array.from({ length: 16 }, (_, i) => ({ id: 100 + i, player1: `a${i}`, player2: `b${i}` }));
// Team i hat Ø-Elo 1500 + i*10 → Team 115 ist Nr. 1.
const elo = (id: string) => 1500 + Number(id.slice(1)) * 10;
const seeded = d.seedTeams(teams, elo);
check(seeded[0].teamId === 115 && seeded[15].teamId === 100, "Setzliste nach Ø-Elo absteigend");
check(seeded.filter((s) => s.pot === 1).map((s) => s.teamId).join() === "115,114,113,112", "Topf 1 = Nr. 1–4");

for (let run = 0; run < 50; run++) {
  const groups = d.drawGroups(seeded);
  const ok =
    groups.length === 4 &&
    groups.every((g, gi) => g.length === 4 && g[0] === seeded[gi].teamId && g.every((id, pos) => seeded.find((s) => s.teamId === id)!.pot === pos + 1)) &&
    new Set(groups.flat()).size === 16;
  if (!ok) { check(false, `Auslosung ${run}: ${JSON.stringify(groups)}`); break; }
  if (run === 49) check(true, "50 Auslosungen: Topf 1 gesetzt, je Gruppe ein Team pro Topf, alle 16 genau einmal");
}

let threw = false;
try { d.drawGroups(seeded.slice(0, 15)); } catch { threw = true; }
check(threw, "ohne genau 16 Teams keine Auslosung");

// Turnierbaum: jeder Gruppensieger gegen einen Zweiten einer anderen Gruppe,
// gleiche Gruppe in verschiedenen Hälften, A und B (Nr. 1 und 2) getrennt.
const q = d.QUARTERS;
check(q.every(([x, y]) => x.place === 1 && y.place === 2 && x.group !== y.group), "VF: Sieger gegen Zweiten einer anderen Gruppe");
const half = (g: string, p: number) => q.findIndex(([x, y]) => (x.group === g && x.place === p) || (y.group === g && y.place === p)) < 2 ? 0 : 1;
check(d.GROUPS.every((g) => half(g, 1) !== half(g, 2)), "Sieger und Zweiter einer Gruppe in verschiedenen Hälften");
check(half("A", 1) !== half("B", 1) && half("C", 1) !== half("D", 1), "Nr. 1/2 und Nr. 3/4 in verschiedenen Hälften");
const pairs = d.GROUP_ROUNDS.flat().map(([a, b]) => [a, b].sort().join());
check(new Set(pairs).size === 6, "Gruppenspielplan: jeder einmal gegen jeden");

process.exit(failed ? 1 : 0);
