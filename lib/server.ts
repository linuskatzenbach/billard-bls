import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { WORLD_TAG, getPlayerByEmail, getWorld } from "./db";
import { computeOverview } from "./progress";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SIGNUP_COOKIE,
  SIGNUP_MAX_AGE,
  cookieOptions,
  sessionToken,
  signupToken,
} from "./auth";

// So lange können Beteiligte einem Spiel widersprechen.
export const DISPUTE_HOURS = 24;

// Nach jeder Änderung: zwischengespeicherte Daten sofort verwerfen, damit
// die Rangliste gleich stimmt.
export function refreshWorld(): void {
  revalidateTag(WORLD_TAG, { expire: 0 });
}

// Die Auswertung (Elo, Level, Abzeichen, Wochenaufgaben) läuft über alle
// Spiele und wird mit jedem Spieler teurer. Deshalb pro Server-Instanz
// zwischenspeichern: neu gerechnet wird nur, wenn sich die Daten geändert
// haben oder der Stand älter als zwei Minuten ist (Wochenwechsel, 7-Tage-Trend).
const OVERVIEW_TTL_MS = 2 * 60 * 1000;
let overviewMemo: { key: string; at: number; ov: ReturnType<typeof computeOverview> } | null = null;

function worldKey(world: Awaited<ReturnType<typeof getWorld>>): string {
  let h = 0;
  const add = (v: string | number | boolean | null) => {
    const str = String(v);
    for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
    h = (Math.imul(h, 31) + 124) | 0;
  };
  for (const p of world.players) {
    add(p.id); add(p.name); add(p.cohort); add(p.hidden); add(p.founder); add(p.is_admin);
  }
  for (const m of world.matches) {
    add(m.id); add(m.winner_id); add(m.loser_id); add(m.winner_elo_after); add(m.loser_elo_after); add(m.created_at); add(m.entered_by);
  }
  return `${world.players.length}:${world.matches.length}:${h}`;
}

export async function getOverview() {
  const world = await getWorld();
  const key = worldKey(world);
  const now = Date.now();
  if (!overviewMemo || overviewMemo.key !== key || now - overviewMemo.at > OVERVIEW_TTL_MS) {
    overviewMemo = { key, at: now, ov: computeOverview(world) };
  }
  const ov = overviewMemo.ov;
  const nameOf = (id: string) => ov.byId[id]?.name ?? id;
  return { world, ov, nameOf };
}

export function siteOrigin(req: NextRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "billard-bls.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Nach erfolgreichem Link/Code: bestehender Spieler → einloggen,
// neue Adresse → weiter zum Profil-Anlegen.
export async function loginResponse(email: string): Promise<NextResponse> {
  const player = await getPlayerByEmail(email);
  if (player) {
    const res = NextResponse.json({ success: true, next: "/profil" });
    res.cookies.set(SESSION_COOKIE, sessionToken({ playerId: player.id, admin: player.is_admin }), cookieOptions(SESSION_MAX_AGE));
    res.cookies.set(SIGNUP_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }
  const res = NextResponse.json({ success: true, next: "/willkommen" });
  res.cookies.set(SIGNUP_COOKIE, signupToken(email), cookieOptions(SIGNUP_MAX_AGE));
  return res;
}

export const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function readJson<T>(req: NextRequest): Promise<Partial<T>> {
  return ((await req.json().catch(() => ({}))) ?? {}) as Partial<T>;
}

export const berlinDateTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
