import type { MetadataRoute } from "next";

/**
 * What makes it installable, which is not cosmetic.
 *
 * On iOS, Safari clears everything a site has stored after about a week of not
 * visiting it. Saved trips live in that storage, so on a phone the whole
 * trips-as-projects feature quietly expires. A web app added to the Home
 * Screen gets its own container that the sweep doesn't touch. So the icon and
 * the persistence are the same fix, and the manifest is what unlocks both.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vamos",
    short_name: "Vamos",
    description: "No planning. Just leave.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#2f6b5e",
    theme_color: "#faf8f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
