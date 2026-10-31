// Datum und Woche nach deutscher Zeit.
export const TIME_ZONE = "Europe/Berlin";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const dayKey = (d: Date | string) => dayKeyFmt.format(typeof d === "string" ? new Date(d) : d);

const keyToUtc = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const utcToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const DAY = 86_400_000;

// Wochen (deutsche Zeit). Bis Sonntag, 1.11.2026 laufen sie von Montag bis
// Sonntag. Danach von Samstag bis Freitag, damit samstags Updates kommen
// können, ohne eine laufende Woche zu ändern. Übergang: die Woche ab
// Mo 2.11. endet schon am Fr 6.11., ab Sa 7.11. gilt Samstag–Freitag.
// Eine Woche heißt nach ihrem ersten Tag ("YYYY-MM-DD").
export const SAT_WEEKS_FROM = "2026-11-07";
const SHORT_WEEK = "2026-11-02"; // Übergangswoche Mo–Fr

function weekOfDay(k: string): string {
  const ms = keyToUtc(k);
  const dow = new Date(ms).getUTCDay(); // So = 0 … Sa = 6
  if (k >= SAT_WEEKS_FROM) return utcToKey(ms - ((dow + 1) % 7) * DAY); // Sa = 0
  return utcToKey(ms - ((dow + 6) % 7) * DAY); // Mo = 0
}

export function weekKey(d: Date | string): string {
  return weekOfDay(dayKey(d));
}

// Letzter Tag einer Woche ("YYYY-MM-DD").
export function weekLastDay(wk: string): string {
  if (wk === SHORT_WEEK) return "2026-11-06";
  return utcToKey(keyToUtc(wk) + 6 * DAY);
}

export function addWeeks(wk: string, n: number): string {
  let k = wk;
  for (let i = 0; i < n; i++) k = utcToKey(keyToUtc(weekLastDay(k)) + DAY);
  for (let i = 0; i > n; i--) k = weekOfDay(utcToKey(keyToUtc(k) - DAY));
  return k;
}

// Tage bis zum Beginn der nächsten Woche (1 = morgen).
export function daysUntilNextWeek(now = new Date()): number {
  const today = keyToUtc(dayKey(now));
  return Math.round((keyToUtc(addWeeks(weekKey(now), 1)) - today) / DAY);
}

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
// Wochentag eines Tages ("Freitag"), kurz: "Fr".
export const weekdayName = (k: string) => WEEKDAYS[new Date(keyToUtc(k)).getUTCDay()];
export const weekdayShort = (k: string) => weekdayName(k).slice(0, 2);

// Letzte Sekunde einer Woche (23:59:59 deutscher Zeit am letzten Tag) als
// ISO-Zeitpunkt – berücksichtigt Sommer- und Winterzeit.
export function weekEndIso(wk: string): string {
  const nextStart = keyToUtc(addWeeks(wk, 1)); // 00:00 UTC
  const offsetH = berlinHour(new Date(nextStart)); // 1 (Winter) oder 2 (Sommer)
  return new Date(nextStart - offsetH * 3_600_000 - 1000).toISOString();
}


const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" });
// Stunde (0–23) nach deutscher Zeit.
export const berlinHour = (d: Date | string) => Number(hourFmt.format(typeof d === "string" ? new Date(d) : d));
