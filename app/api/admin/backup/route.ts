import { isAdmin } from "@/lib/auth";
import { buildBackup } from "@/lib/backup";
import { jsonError } from "@/lib/server";

// Sicherung von Hand herunterladen (nur Admin).
export async function GET() {
  if (!(await isAdmin())) return jsonError("Nur für den Admin.", 403);
  const { json, filename } = await buildBackup();
  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
