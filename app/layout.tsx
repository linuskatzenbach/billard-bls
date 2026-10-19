import type { Metadata, Viewport } from "next";
import "./globals.css";

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
