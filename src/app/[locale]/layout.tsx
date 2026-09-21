import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { AppProviders } from "@/components/providers/app-providers";
import { Toaster } from "@/components/ui/sonner";
import {
  defaultLocale,
  directionForLocale,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans-en",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-ar",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#144078",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:43123",
  ),
  title: {
    default: "غسيلك | GHASILAK — Laundry pickup Muscat",
    template: "%s · غسيلك | GHASILAK",
  },
  description:
    "Laundry pickup and delivery in Muscat — غسيل وتوصيل مسقط. Doorstep wash & iron with GHASILAK.",
  manifest: "/manifest.webmanifest",
  applicationName: "GHASILAK",
  keywords: [
    "Laundry delivery Muscat",
    "Laundry pickup Muscat",
    "غسيل وتوصيل مسقط",
    "مغسلة توصيل للمنازل مسقط",
    "GHASILAK",
    "غسيلك",
  ],
  openGraph: {
    type: "website",
    locale: "ar_OM",
    alternateLocale: ["en_OM"],
    siteName: "GHASILAK | غسيلك",
    title: "غسيلك | GHASILAK — Laundry pickup Muscat",
    description:
      "Doorstep laundry pickup and delivery across Muscat. Wash & iron from 0.400 OMR per piece.",
    images: [
      {
        url: "/brand/ghasilak-logo.png",
        width: 1168,
        height: 1021,
        alt: "GHASILAK / غسيلك",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "غسيلك | GHASILAK",
    description: "Laundry pickup and delivery in Muscat.",
    images: ["/brand/ghasilak-logo.png"],
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "غسيلك",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export function generateStaticParams() {
  return [{ locale: "ar" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw ?? defaultLocale;
  const dir = directionForLocale(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${jakarta.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProviders>
          <PwaRegister />
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
