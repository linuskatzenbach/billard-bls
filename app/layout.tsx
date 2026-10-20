import type { Metadata, Viewport } from "next";
import "./globals.css";
import BreakSplash from "./BreakSplash";
import TabBar from "./TabBar";

export const metadata: Metadata = {
  title: "Billard-Rangliste",
  description: "Jetzt wird gezockt!",
  appleWebApp: {
    capable: true,
    title: "Billard",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#123028",
  viewportFit: "cover",
};

// Die Break-Animation soll nur beim ersten Öffnen der Website laufen. Fällt
// Next.js bei einem Seitenwechsel auf ein komplettes Neuladen zurück (z. B.
// wenn JavaScript auf einem Gerät nicht richtig startet oder nach einem neuen
// Deployment), käme sonst jedes Mal wieder der Billardtisch. Das Skript läuft
// vor dem ersten Zeichnen und blendet die Animation aus, wenn sie in diesem
// Tab bzw. dieser App-Sitzung schon einmal gezeigt wurde.
const splashOnce = `try{var s=window.sessionStorage;if(s.getItem("bs-seen")){document.documentElement.classList.add("bs-seen")}else{s.setItem("bs-seen","1")}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: splashOnce }} />
      </head>
      <body>
        <BreakSplash />
        <div className="container">{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
