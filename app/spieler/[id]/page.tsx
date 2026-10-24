import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import ProfileView from "../../ProfileView";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [{ world, ov }, session] = await Promise.all([getOverview(), getSession()]);
  const s = ov.byId[id];
  if (!s || s.hidden) notFound();
  if (session?.playerId === id) redirect("/mein");
  return <ProfileView s={s} world={world} ov={ov} viewerId={session?.playerId ?? null} />;
}
