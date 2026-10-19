import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Billard-Rangliste",
    short_name: "Billard",
    description: "Jetzt wird gezockt!",
    start_url: "/",
    display: "standalone",
    background_color: "#123028",
    theme_color: "#123028",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
