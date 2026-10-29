import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AnimationPreview from "./AnimationPreview";

export default async function AnimationPage() {
  await connection();
  const session = await getSession();
  if (!session?.admin) redirect("/profil");
  return (
    <>
      <Link href="/profil/admin" className="back-link">
        ← Admin-Bereich
      </Link>
      <AnimationPreview />
    </>
  );
}
