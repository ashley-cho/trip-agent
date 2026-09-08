import type { Metadata, Viewport } from "next";
import "./globals.css";
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
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
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
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
