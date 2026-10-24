import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Anmeldung. Die Sitzung steckt in einem signierten Cookie (kein
// Datenbankeintrag nötig).
//
// Umgebungsvariablen in Vercel:
//   SESSION_SECRET   – Schlüssel zum Signieren der Cookies (empfohlen;
//                      ohne ihn wird ADMIN_PASSWORD verwendet)
//   ADMIN_PASSWORD   – Notfall-Login für den Admin ohne Mail
//   ADMIN_USERNAME   – Benutzername dafür, Standard: "admin"
//   ADMIN_PLAYER_ID  – welcher Spieler der Admin ist, Standard: "linus"
//   GMAIL_USER / GMAIL_APP_PASSWORD – Mail-Versand (siehe lib/mail.ts)

export const SESSION_COOKIE = "billard_session";
export const SIGNUP_COOKIE = "billard_signup";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 Tage
export const SIGNUP_MAX_AGE = 60 * 60; // 1 Stunde für das Onboarding

export const UNI_DOMAIN = "law-school.de";

export type Session = { playerId: string; admin: boolean };

function secret(): string {
  const s = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("SESSION_SECRET (oder ADMIN_PASSWORD) fehlt in den Umgebungsvariablen.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

// Vergleich in konstanter Zeit.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

// Nur Uni-Adressen: vorname.nachname@law-school.de
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  const m = email.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+)$/);
  if (!m || m[2] !== UNI_DOMAIN) return null;
  return email;
}

// Vorschlag für den Anzeigenamen aus der Mail: "max.mustermann" → "Max M."
export function suggestName(email: string): string {
  const local = email.split("@")[0];
  const parts = local.split(/[._-]+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length === 0) return "";
  if (parts.length === 1) return cap(parts[0]);
  return `${cap(parts[0])} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function createSigned(data: object, maxAge: number): string {
  const exp = Date.now() + maxAge * 1000;
  const payload = Buffer.from(JSON.stringify({ ...data, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifySigned<T>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  if (!process.env.SESSION_SECRET && !process.env.ADMIN_PASSWORD) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(sig, sign(payload))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionToken(s: Session): string {
  return createSigned({ pid: s.playerId, adm: s.admin }, SESSION_MAX_AGE);
}

export function signupToken(email: string): string {
  return createSigned({ email }, SIGNUP_MAX_AGE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const d = verifySigned<{ pid: unknown; adm: unknown }>(store.get(SESSION_COOKIE)?.value);
  if (!d || typeof d.pid !== "string") return null;
  return { playerId: d.pid, admin: d.adm === true };
}

export async function getSignupEmail(): Promise<string | null> {
  const store = await cookies();
  const d = verifySigned<{ email: unknown }>(store.get(SIGNUP_COOKIE)?.value);
  return d && typeof d.email === "string" ? d.email : null;
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession())?.admin === true;
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

// ---- Notfall-Login für den Admin (Benutzername + Passwort) -------------

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdminLogin(username: string, password: string): Session | null {
  const adminUser = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return null;
  const userOk = safeEqual(username.trim().toLowerCase(), adminUser);
  const passOk = safeEqual(password, adminPassword);
  return userOk && passOk ? { playerId: process.env.ADMIN_PLAYER_ID ?? "linus", admin: true } : null;
}
