// Tests für die Spiellogik (ohne Datenbank): Wochen, Level, Elo, Abzeichen,
// Wochenaufgaben. Jede Regel hier ist eine, auf die sich Linus festgelegt hat
// – bricht eine Änderung sie, schlägt der Test an.
import assert from "node:assert/strict";
import type { MatchRow, PlayerRow, World } from "../lib/db.ts";

const { weekKey, addWeeks, weekEndIso, daysUntilNextWeek } = await import("../lib/time.ts");
const { levelFor, tierOf, computeOverview, MAX_LEVEL } = await import("../lib/progress.ts");
const { eloDelta, START_ELO } = await import("../lib/elo.ts");
const { computeAchievements } = await import("../lib/achievements.ts");

let failed = 0;
let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.log(`✗ ${name}\n  ${(err as Error).message.split("\n").join("\n  ")}`);
  }
}

// ---- Kleine Spielwelt zum Nachspielen -------------------------------------

function makeWorld(cohorts: Record<string, string>, startElo: Record<string, number> = {}) {
  const players: PlayerRow[] = Object.entries(cohorts).map(([id, cohort]) => ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    email: null,
    cohort,
    hidden: false,
    founder: false,
    is_admin: false,
    created_at: "2026-10-01T10:00:00Z",
  }));
  const elo: Record<string, number> = { ...startElo };
  const matches: MatchRow[] = [];
  let id = 0;
  const cur = (p: string) => elo[p] ?? START_ELO;

  // Spiel eintragen wie die App: Elo-Schnitt der Teams, Änderung voll für jeden.
  const play = (winners: string[], losers: string[], at: string): MatchRow => {
    const avg = (xs: string[]) => xs.reduce((n, p) => n + cur(p), 0) / xs.length;
    const d = eloDelta(avg(winners), avg(losers));
    const b = Object.fromEntries([...winners, ...losers].map((p) => [p, cur(p)]));
    for (const p of winners) elo[p] = cur(p) + d.win;
    for (const p of losers) elo[p] = cur(p) + d.lose;
    const [w1, w2] = winners;
    const [l1, l2] = losers;
    const m: MatchRow = {
      id: ++id,
      winner_id: w1,
      loser_id: l1,
      winner_elo_before: b[w1],
      loser_elo_before: b[l1],
      winner_elo_after: elo[w1],
      loser_elo_after: elo[l1],
      created_at: new Date(at).toISOString(),
      entered_by: w1,
      winner2_id: w2 ?? null,
      loser2_id: l2 ?? null,
      winner2_elo_before: w2 ? b[w2] : null,
      loser2_elo_before: l2 ? b[l2] : null,
      winner2_elo_after: w2 ? elo[w2] : null,
      loser2_elo_after: l2 ? elo[l2] : null,
    };
    matches.push(m);
    return m;
  };
  const world: World = { players, matches };
  return { world, play, elo };
}

const badgesOf = (world: World, id: string, now = new Date("2026-12-01T12:00:00Z")) =>
  new Set(computeAchievements(world, now)[id]?.badges.map((b) => b.key) ?? []);

// ---- Wochen ---------------------------------------------------------------

test("Wochen: Mo–So bis 1.11., Übergangswoche Mo 2.–Fr 6.11., ab 7.11. Sa–Fr", () => {
  assert.equal(weekKey("2026-11-01T20:00:00Z"), "2026-10-26"); // So 1.11. abends
  assert.equal(weekKey("2026-11-02T08:00:00Z"), "2026-11-02"); // Mo
  assert.equal(weekKey("2026-11-06T22:30:00Z"), "2026-11-02"); // Fr 23:30 deutscher Zeit
  assert.equal(weekKey("2026-11-06T23:30:00Z"), "2026-11-07"); // Sa 00:30 deutscher Zeit
  assert.equal(weekKey("2026-11-13T20:00:00Z"), "2026-11-07"); // Fr 13.11.
  assert.equal(weekKey("2026-11-14T10:00:00Z"), "2026-11-14"); // Sa 14.11.
});

test("Wochen: vor- und zurückblättern über den Übergang", () => {
  assert.equal(addWeeks("2026-10-26", 1), "2026-11-02");
  assert.equal(addWeeks("2026-11-02", 1), "2026-11-07");
  assert.equal(addWeeks("2026-11-07", 1), "2026-11-14");
  assert.equal(addWeeks("2026-11-07", -1), "2026-11-02");
  assert.equal(addWeeks("2026-11-02", -1), "2026-10-26");
  assert.equal(addWeeks("2026-10-26", 3), "2026-11-14");
});

test("Wochen: Ende einer Woche um 23:59:59 deutscher Zeit (Winter- und Sommerzeit)", () => {
  assert.equal(weekEndIso("2026-11-02"), "2026-11-06T22:59:59.000Z"); // Übergangswoche endet Freitag
  assert.equal(weekEndIso("2026-10-19"), "2026-10-25T22:59:59.000Z"); // Zeitumstellung am 25.10.
  assert.equal(weekEndIso("2026-11-07"), "2026-11-13T22:59:59.000Z");
});

test("Wochen: Countdown bis zur nächsten Woche", () => {
  assert.equal(daysUntilNextWeek(new Date("2026-11-06T10:00:00Z")), 1); // Fr → Sa
  assert.equal(daysUntilNextWeek(new Date("2026-11-07T10:00:00Z")), 7); // Sa → nächster Sa
  assert.equal(daysUntilNextWeek(new Date("2026-11-13T10:00:00Z")), 1); // Fr → Sa
});

// ---- Level ----------------------------------------------------------------

test("Level: 18 Level, Schwellen und Kränze", () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(99).level, 1);
  assert.equal(levelFor(100).level, 2);
  assert.equal(levelFor(999).level, 3);
  assert.equal(levelFor(1_000).level, 4);
  assert.equal(levelFor(38_000).level, MAX_LEVEL);
  assert.equal(levelFor(10_000_000).level, MAX_LEVEL);
  assert.equal(levelFor(38_000).next, null);
  assert.equal(MAX_LEVEL, 18);
  assert.equal(tierOf(4).name, "Bronze");
  assert.equal(tierOf(7).name, "Silber");
  assert.equal(tierOf(10).name, "Gold");
  assert.equal(tierOf(16).name, "Champion");
  assert.equal(tierOf(18).stage, 3);
});

test("Level: mehr XP heißt nie ein niedrigeres Level", () => {
  let last = -1;
  for (let xp = 0; xp <= 40_000; xp += 50) {
    const lv = levelFor(xp).level;
    assert.ok(lv >= last, `Level fällt bei ${xp} XP`);
    last = lv;
  }
});

// ---- Elo --------------------------------------------------------------------

test("Elo: gleich starke Spieler ±20, Summe bleibt gleich", () => {
  assert.deepEqual(eloDelta(1500, 1500), { win: 20, lose: -20 });
  const d = eloDelta(1400, 1700);
  assert.ok(d.win > 20, "Außenseitersieg bringt mehr als 20");
  assert.equal(d.win + d.lose, 0);
});

test("Elo: Doppel rechnet mit dem Team-Schnitt, Änderung voll für jeden", () => {
  const { world, play } = makeWorld({ a: "2022", b: "2022", c: "2022", d: "2022" }, { a: 1700, b: 1400, c: 1500, d: 1550 });
  const m = play(["a", "b"], ["c", "d"], "2026-11-03T18:00:00Z");
  const d = eloDelta(1550, 1525);
  assert.equal(m.winner_elo_after - m.winner_elo_before, d.win);
  assert.equal(m.winner2_elo_after! - m.winner2_elo_before!, d.win);
  assert.equal(m.loser2_elo_after! - m.loser2_elo_before!, d.lose);
  const ov = computeOverview(world, new Date("2026-11-04T12:00:00Z"));
  assert.equal(ov.byId.a.elo, 1700 + d.win);
});

// ---- Abzeichen --------------------------------------------------------------

test("Abzeichen: Erster Sieg und Heißer Lauf (3 in Folge)", () => {
  const { world, play } = makeWorld({ a: "2022", b: "2022" });
  play(["a"], ["b"], "2026-11-03T18:00:00Z");
  play(["a"], ["b"], "2026-11-03T18:10:00Z");
  const two = badgesOf(world, "a");
  assert.ok(two.has("erster-sieg"));
  assert.ok(!two.has("heisser-lauf:0"));
  play(["a"], ["b"], "2026-11-03T18:20:00Z");
  assert.ok(badgesOf(world, "a").has("heisser-lauf:0"));
});

test("Doppelschlag: zwei Doppel-Siege in Folge gegen ein 100+ Elo stärkeres Team", () => {
  const start = { a: 1500, b: 1500, c: 1750, d: 1750, e: 1500 };
  const cohorts = { a: "2022", b: "2022", c: "2022", d: "2022", e: "2022" };
  // genau so: zwei Siege nacheinander
  let w = makeWorld(cohorts, start);
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:00:00Z");
  assert.ok(!badgesOf(w.world, "a").has("doppelschlag"), "nach einem Sieg noch nicht");
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:10:00Z");
  assert.ok(badgesOf(w.world, "a").has("doppelschlag"));
  // ein Einzel dazwischen unterbricht nicht
  w = makeWorld(cohorts, start);
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:00:00Z");
  w.play(["e"], ["a"], "2026-11-03T18:05:00Z");
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:10:00Z");
  assert.ok(badgesOf(w.world, "a").has("doppelschlag"), "Einzel dazwischen darf nicht unterbrechen");
  // eine Doppel-Niederlage dazwischen setzt zurück
  w = makeWorld(cohorts, start);
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:00:00Z");
  w.play(["c", "d"], ["a", "b"], "2026-11-03T18:05:00Z");
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:10:00Z");
  assert.ok(!badgesOf(w.world, "a").has("doppelschlag"), "Niederlage dazwischen muss zurücksetzen");
  // gegen ein gleich starkes Team gibt es nichts
  w = makeWorld(cohorts);
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:00:00Z");
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:10:00Z");
  assert.ok(!badgesOf(w.world, "a").has("doppelschlag"));
});

test("Brückenbauer: Partner aus anderem Jahrgang gegen zwei aus dem eigenen", () => {
  let w = makeWorld({ linus: "2022", neu: "2026", x: "2022", y: "2022" });
  w.play(["linus", "neu"], ["x", "y"], "2026-11-03T18:00:00Z");
  assert.ok(badgesOf(w.world, "linus").has("brueckenbauer"));
  assert.ok(!badgesOf(w.world, "neu").has("brueckenbauer"), "der Partner aus 2026 schlägt keine 2026er");
  w = makeWorld({ linus: "2022", neu: "2026", x: "2022", y: "2025" });
  w.play(["linus", "neu"], ["x", "y"], "2026-11-03T18:00:00Z");
  assert.ok(!badgesOf(w.world, "linus").has("brueckenbauer"), "nur einer der Gegner aus dem eigenen Jahrgang");
  w = makeWorld({ linus: "2022", mit: "WissMit", x: "2022", y: "2022" });
  w.play(["linus", "mit"], ["x", "y"], "2026-11-03T18:00:00Z");
  assert.ok(badgesOf(w.world, "linus").has("brueckenbauer"), "WissMit zählt als normaler Jahrgang");
});

test("Seitenwechsel: am selben Tag mit jemandem und gegen ihn gewonnen", () => {
  let w = makeWorld({ a: "2022", b: "2022", c: "2022", d: "2022" });
  w.play(["a", "b"], ["c", "d"], "2026-11-03T17:00:00Z");
  w.play(["a"], ["b"], "2026-11-03T19:00:00Z");
  assert.ok(badgesOf(w.world, "a").has("seitenwechsel"));
  w = makeWorld({ a: "2022", b: "2022", c: "2022", d: "2022" });
  w.play(["a", "b"], ["c", "d"], "2026-11-03T17:00:00Z");
  w.play(["a"], ["b"], "2026-11-04T19:00:00Z");
  assert.ok(!badgesOf(w.world, "a").has("seitenwechsel"), "anderer Tag zählt nicht");
});

test("Underdog und Revanche gibt es nur im Einzel", () => {
  const w = makeWorld({ a: "2022", b: "2022", c: "2022", d: "2022" }, { a: 1400, b: 1400, c: 1700, d: 1700 });
  w.play(["a", "b"], ["c", "d"], "2026-11-03T18:00:00Z");
  assert.ok(!badgesOf(w.world, "a").has("underdog"), "Doppel darf kein Underdog geben");
  const s = makeWorld({ a: "2022", c: "2022" }, { a: 1400, c: 1700 });
  s.play(["a"], ["c"], "2026-11-03T18:00:00Z");
  assert.ok(badgesOf(s.world, "a").has("underdog"));
});

test("Gestufte Doppel-Abzeichen: Teamplayer, Partnerbörse", () => {
  const w = makeWorld({ a: "2022", b: "2022", c: "2022", d: "2022", e: "2022" });
  const partners = ["b", "c", "d"];
  for (let i = 0; i < 10; i++) {
    const p = partners[i % 3];
    const opps = ["b", "c", "d", "e"].filter((x) => x !== p).slice(0, 2);
    w.play(["a", p], opps, `2026-11-0${3 + (i % 3)}T1${i % 10}:00:00Z`);
  }
  const b = badgesOf(w.world, "a");
  assert.ok(b.has("teamplayer:0"), "10 Doppel → Teamplayer Bronze");
  assert.ok(b.has("partnerboerse:0"), "3 Partner → Partnerbörse Bronze");
});

// ---- Rangliste & Wochenzocker ---------------------------------------------

test("Doppel zählt beim Wochenzocker wie ein Spiel", () => {
  const w = makeWorld({ a: "2022", b: "2022", c: "2022", d: "2022" });
  w.play(["a"], ["b"], "2026-11-10T18:00:00Z");
  w.play(["a", "b"], ["c", "d"], "2026-11-10T19:00:00Z");
  const ov = computeOverview(w.world, new Date("2026-11-11T12:00:00Z"));
  assert.equal(ov.byId.a.weekGames, 2);
  assert.equal(ov.byId.c.weekGames, 1);
  assert.equal(ov.byId.a.doubles, 1);
});

test("Gespeicherte Elo = Elo aus der Auswertung", () => {
  const w = makeWorld({ a: "2022", b: "2022", c: "2022", d: "2022" });
  const ids = ["a", "b", "c", "d"];
  for (let i = 0; i < 40; i++) {
    const r = [...ids].sort(() => Math.random() - 0.5);
    if (i % 3 === 0) w.play([r[0], r[1]], [r[2], r[3]], new Date(Date.UTC(2026, 10, 2, 10, i)).toISOString());
    else w.play([r[0]], [r[1]], new Date(Date.UTC(2026, 10, 2, 10, i)).toISOString());
  }
  const ov = computeOverview(w.world, new Date("2026-11-05T12:00:00Z"));
  for (const id of ids) assert.equal(ov.byId[id].elo, w.elo[id], `Elo von ${id}`);
});

// ---- Wochenaufgaben ---------------------------------------------------------

test("Wochenaufgaben: gegnerbezogene Aufgaben tragen immer den Zusatz „im Einzel“", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const w = makeWorld(Object.fromEntries(ids.map((i) => [i, "2022"])));
  // genug Vorgeschichte, damit alle Aufgabentypen vorkommen können
  for (let i = 0; i < 120; i++) {
    const r = [...ids].sort(() => Math.random() - 0.5);
    const at = new Date(Date.UTC(2026, 9, 19 + Math.floor(i / 6), 12, i % 60)).toISOString();
    if (i % 4 === 0) w.play([r[0], r[1]], [r[2], r[3]], at);
    else w.play([r[0]], [r[1]], at);
  }
  const specific = new Set(["beatLastLoss", "beatAbove", "beatTop3", "beat100", "beatNemesis"]);
  let seen = 0;
  for (const day of ["2026-10-28", "2026-11-03", "2026-11-05", "2026-11-08", "2026-11-12", "2026-11-19"]) {
    const now = new Date(`${day}T12:00:00Z`);
    // nur Spiele, die zu diesem Zeitpunkt schon gespielt waren
    const past = { ...w.world, matches: w.world.matches.filter((m) => new Date(m.created_at) < now) };
    const ach = computeAchievements(past, now);
    for (const id of ids) {
      const qs = ach[id].quests;
      assert.equal(qs.length, 3, `${id} hat ${qs.length} Aufgaben`);
      assert.deepEqual(qs.map((q) => q.tier), ["leicht", "mittel", "schwer"]);
      for (const q of qs) {
        if (specific.has(q.kind)) {
          seen++;
          assert.ok(q.title.includes("im Einzel"), `„${q.title}“ ohne „im Einzel“`);
        }
      }
    }
  }
  assert.ok(seen > 0, "keine gegnerbezogene Aufgabe gezogen – Test aussagelos");
});

console.log(failed === 0 ? `OK – ${passed} Logik-Tests bestanden` : `FEHLER – ${failed} von ${passed + failed} Logik-Tests fehlgeschlagen`);
process.exit(failed === 0 ? 0 : 1);
