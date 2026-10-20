import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Login für den persönlichen Bereich. Die Sitzung steckt in einem
// signierten Cookie (kein Datenbankeintrag nötig). Zurzeit gibt es nur das
// Admin-Profil; die Spielerprofile kommen später dazu.
//
// In Vercel unter Settings → Environment Variables setzen:
//   ADMIN_PASSWORD   – Passwort für das Admin-Profil (Pflicht)
//   ADMIN_USERNAME   – Benutzername, Standard: "admin"
//   SESSION_SECRET   – optional, eigener Schlüssel zum Signieren der Cookies
//                      (ohne ihn wird ADMIN_PASSWORD verwendet; ändert man
//                      das Passwort, ist man danach überall ausgeloggt)

export const SESSION_COOKIE = "billard_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 Tage

export type Role = "admin";
export type Session = { user: string; role: Role };

function secret(): string {
  const s = process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD fehlt in den Umgebungsvariablen.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

// Vergleich in konstanter Zeit, damit sich Passwörter nicht über
// Antwortzeiten erraten lassen.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// Prüft Benutzername und Passwort; gibt bei Erfolg die Sitzung zurück.
export function checkLogin(username: string, password: string): Session | null {
  const adminUser = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return null;
  const userOk = safeEqual(username.trim().toLowerCase(), adminUser);
  const passOk = safeEqual(password, adminPassword);
  return userOk && passOk ? { user: adminUser, role: "admin" } : null;
}

export function createToken(session: Session): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ ...session, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined): Session | null {
  if (!token || !process.env.ADMIN_PASSWORD) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (data.role !== "admin" || typeof data.user !== "string") return null;
    return { user: data.user, role: data.role };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}
