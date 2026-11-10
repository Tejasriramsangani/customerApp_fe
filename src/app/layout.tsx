import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MotionPreferences } from "../components/ui/MotionPreferences";
import { MobileViewport } from "../components/layout/MobileViewport";

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
  viewportFit: "cover",         // Respect notch / edge-to-edge on iOS & Android
  interactiveWidget: "resizes-content",
  themeColor: "#1B5E3A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      {/* Browser extensions can add body attributes before React hydrates (e.g. ColorZilla). */}
      <body suppressHydrationWarning className="min-h-full bg-slate-950 text-slate-900 antialiased selection:bg-emerald-600 selection:text-white">
        <MotionPreferences>
        <MobileViewport />
        {/*
          Keep the customer experience phone-sized, including in desktop browsers.
        */}
        <div className="customer-preview w-full bg-canvas flex items-start justify-center p-0">
          <div id="customer-mobile-shell" className="customer-mobile-shell w-full max-w-[430px] bg-canvas shadow-lg relative flex flex-col">
            {children}
          </div>
        </div>
              </MotionPreferences>
      </body>
    </html>
  );
}
