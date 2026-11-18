import { connection } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getWorld } from "@/lib/db";
import { computeUsage, usageCsv } from "@/lib/usage";
import { jsonError } from "@/lib/server";
import { dayKey } from "@/lib/time";

// Nutzungszahlen pro Tag als CSV herunterladen (nur Admin).
export async function GET() {
  await connection();
  if (!(await isAdmin())) return jsonError("Nur für den Admin.", 403);
  const csv = usageCsv(computeUsage(await getWorld()));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="billard-bls-nutzung-${dayKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
