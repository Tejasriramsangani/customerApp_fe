import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASLI KAATA - Real Weight. Real Value.",
  description: "Doorstep scrap collection with digital precision weighing, instant payment, and live market rates.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ASLI KAATA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",         // Respect notch / edge-to-edge on iOS & Android
  themeColor: "#0A3D2B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Plus Jakarta Sans — loaded via CDN link; falls back to system font if offline.
            Using a plain <link> tag avoids the next/font build-time network dependency. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-slate-950 text-slate-900 antialiased selection:bg-emerald-600 selection:text-white">
        {/*
          Responsive Container:
          • On a real Android/iOS device (Capacitor): fills the full screen, no frame.
          • On a desktop browser: centred luxury phone-frame for demo / testing.
        */}
        <div className="min-h-screen w-full bg-gradient-to-br from-[#041A12] via-[#0A3D2B] to-[#062418] flex items-center justify-center p-0 md:py-8 md:px-4">
          <div className="w-full max-w-md min-h-screen md:min-h-[860px] md:max-h-[920px] md:h-[88vh] md:rounded-[40px] bg-[#F8FAFC] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] relative overflow-hidden flex flex-col md:border-[7px] md:border-slate-800/90">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
