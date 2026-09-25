import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Billard Elo",
  description: "Elo-Rangliste für unsere Billard-Runde",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
