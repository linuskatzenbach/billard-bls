import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { picksFor } from "@/lib/picks";
import ResultForm from "../../ResultForm";

export default async function TestPage() {
  await connection();
  const session = await getSession();
  if (!session?.admin) redirect("/profil");
  const { ov } = await getOverview();
  const { me, opponents } = picksFor(ov, session.playerId);
  if (!me) redirect("/profil");
  return <ResultForm mode="test" me={me} opponents={opponents} />;
}
