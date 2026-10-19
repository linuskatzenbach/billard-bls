/** @type {import('next').NextConfig} */
const nextConfig = {
  // Seitenhülle (inkl. Ladeanimation) wird vorab gebaut und sofort
  // ausgeliefert; die Daten aus der Datenbank strömen danach nach.
  cacheComponents: true,
};

module.exports = nextConfig;
