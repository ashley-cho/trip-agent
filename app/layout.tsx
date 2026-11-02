import type { Metadata, Viewport } from "next";
import "./globals.css";

// Two faces: Instrument Serif for names and headings, Inter Tight for the
// rest. Loaded as a stylesheet rather than through next/font, which fetches
// at build time and cannot in every build environment this repo is built in.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:ital,wght@0,400;0,500;0,600;1,400&display=swap";
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
    { media: "(prefers-color-scheme: light)", color: "#ede9e2" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
  // The phone is the point now: edge-to-edge under the notch.
  //
  // maximumScale: 1 is what stops iOS Safari zooming the page in when a
  // 14px field is focused. Safari has ignored it for pinch-zoom since iOS
  // 10, so she can still zoom by hand; it only switches off the focus zoom.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
