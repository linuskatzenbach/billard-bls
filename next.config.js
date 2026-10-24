/** @type {import('next').NextConfig} */
const nextConfig = {
  // Seitenhülle (inkl. Ladeanimation) wird vorab gebaut und sofort
  // ausgeliefert; die Daten aus der Datenbank strömen danach nach.
  cacheComponents: true,

  // "Mein Bereich" lag früher unter /mein – alte Links, Lesezeichen und
  // Home-Bildschirm-Icons landen so weiterhin richtig.
  async redirects() {
    return [
      { source: "/mein", destination: "/profil", permanent: true },
      { source: "/mein/:path*", destination: "/profil/:path*", permanent: true },
    ];
  },
};

module.exports = nextConfig;
