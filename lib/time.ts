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

// Montag der Woche (deutsche Zeit) als "YYYY-MM-DD".
export function weekKey(d: Date | string): string {
  const k = dayKey(d);
  const ms = keyToUtc(k);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Mo = 0
  return utcToKey(ms - dow * DAY);
}
export const addWeeks = (wk: string, n: number) => utcToKey(keyToUtc(wk) + n * 7 * DAY);

// Letzte Sekunde einer Woche (So 23:59:59 deutscher Zeit) als ISO-Zeitpunkt –
// berücksichtigt Sommer- und Winterzeit.
export function weekEndIso(wk: string): string {
  const nextMonday = keyToUtc(addWeeks(wk, 1)); // 00:00 UTC
  const offsetH = berlinHour(new Date(nextMonday)); // 1 (Winter) oder 2 (Sommer)
  return new Date(nextMonday - offsetH * 3_600_000 - 1000).toISOString();
}


const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" });
// Stunde (0–23) nach deutscher Zeit.
export const berlinHour = (d: Date | string) => Number(hourFmt.format(typeof d === "string" ? new Date(d) : d));
