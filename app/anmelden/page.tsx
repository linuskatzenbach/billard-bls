import { connection } from "next/server";
import LinkLogin from "./LinkLogin";

// Ziel des Links aus der Anmelde-Mail.
export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  return <LinkLogin token={token} />;
}
