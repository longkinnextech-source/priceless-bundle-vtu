import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: {
    default: "Priceless Bundle — Data that never overcharges",
    template: "%s · Priceless Bundle",
  },
  description:
    "Buy MTN, Telecel and AirtelTigo data bundles at agent prices. Instant delivery, wallet top-ups, and a squad programme for resellers in Ghana.",
  applicationName: "Priceless Bundle",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png" }],
    shortcut: [{ url: "/logo.png" }],
  },
  openGraph: {
    title: "Priceless Bundle",
    description: "Data bundles at agent prices, delivered instantly across Ghana.",
    siteName: "Priceless Bundle",
    images: [{ url: "/logo.png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Priceless Bundle",
    description: "Data bundles at agent prices, delivered instantly across Ghana.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0a09",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <ToastProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
