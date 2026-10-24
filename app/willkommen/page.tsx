import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getSignupEmail } from "@/lib/auth";
import { COHORTS, firstNameFromEmail } from "@/lib/names";
import Onboarding from "./Onboarding";

// Profil anlegen nach dem ersten Login mit einer neuen Uni-Mail.
export default async function WillkommenPage() {
  await connection();
  if (await getSession()) redirect("/profil");
  const email = await getSignupEmail();
  if (!email) {
    return (
      <div className="auth">
        <h1>Willkommen!</h1>
        <p className="subtitle">Deine Anmeldung ist abgelaufen.</p>
        <Link href="/profil" className="bigbtn">
          Neuen Link anfordern
        </Link>
      </div>
    );
  }
  return <Onboarding first={firstNameFromEmail(email)} cohorts={COHORTS} />;
}
