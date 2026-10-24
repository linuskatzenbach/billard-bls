import Link from "next/link";
import LoginForm from "../profil/LoginForm";

// Versteckter Notfall-Login für den Admin (falls der Mail-Versand streikt).
// Nirgends verlinkt – direkt /admin-login aufrufen.
export default function AdminLoginPage() {
  return (
    <div className="auth">
      <h1>Admin-Login</h1>
      <p className="subtitle">Notfall-Zugang mit Benutzername und Passwort.</p>
      <LoginForm />
      <Link href="/profil" className="nav-link">
        Zu Mein Bereich
      </Link>
    </div>
  );
}
