import type { Metadata, Viewport } from "next";
import "./globals.css";

// One face, everywhere. Newsreader has an optical-size axis, so the same
// family sets a 36px heading and 13px meta without looking like two fonts.
// Loaded as a stylesheet rather than through next/font, which fetches at
// build time and cannot in every build environment this repo is built in.
const NEWSREADER =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&display=swap";
import { THEME_SCRIPT } from "@/components/Theme";

export const metadata: Metadata = {
  title: "Vamos",
  description: "No planning. Just leave.",
  applicationName: "Vamos",
  // Installed on a Home Screen this runs without Safari's chrome, and, more
  // to the point, keeps its saved trips past the seven days Safari otherwise
  // gives them.
  appleWebApp: { capable: true, title: "Vamos", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
  // The phone is the point now, so no pinch-zoom lockout and edge-to-edge
  // under the notch.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before first paint, or the page flashes light on its way to dark. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={NEWSREADER} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
