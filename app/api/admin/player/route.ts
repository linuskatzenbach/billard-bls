import { NextRequest, NextResponse } from "next/server";
import { isAdmin, normalizeEmail } from "@/lib/auth";
import { getPlayerByEmail, isNameTaken, updatePlayer } from "@/lib/db";
import { validateName } from "@/lib/names";
import { jsonError, readJson, refreshWorld } from "@/lib/server";

// Admin: Spieler umbenennen, Uni-Mail zuordnen, aus-/einblenden.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return jsonError("Nur für den Admin.", 403);
  const body = await readJson<{ id: string; name: string; email: string; hidden: boolean }>(req);
  const id = String(body.id ?? "");
  const fields: { name?: string; email?: string | null; hidden?: boolean } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim().replace(/\s+/g, " ");
    const err = validateName(name);
    if (err) return jsonError(err);
    if (await isNameTaken(name, id)) return jsonError("Diesen Namen gibt es schon.");
    fields.name = name;
  }
  if (body.email !== undefined) {
    const raw = String(body.email ?? "").trim();
    if (raw === "") fields.email = null;
    else {
      const email = normalizeEmail(raw);
      if (!email) return jsonError("Bitte eine Uni-Mail (…@law-school.de) eingeben.");
      const other = await getPlayerByEmail(email);
      if (other && other.id !== id) return jsonError(`Diese Mail gehört schon zu ${other.name}.`);
      fields.email = email;
    }
  }
  if (body.hidden !== undefined) fields.hidden = Boolean(body.hidden);

  await updatePlayer(id, fields);
  refreshWorld();
  return NextResponse.json({ success: true });
}
