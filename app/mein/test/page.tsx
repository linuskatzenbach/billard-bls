import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import ResultForm from "../../ResultForm";

export default async function TestPage() {
  if (!(await isAdmin())) redirect("/mein");
  return <ResultForm mode="test" />;
}
