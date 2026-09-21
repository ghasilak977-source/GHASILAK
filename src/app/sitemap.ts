import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://ghasilak.example";

const publicPaths = [
  "",
  "/pricing",
  "/services",
  "/areas",
  "/how-it-works",
  "/faq",
  "/contact",
  "/terms",
  "/privacy",
  "/order",
  "/login",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["ar", "en"] as const;
  const now = new Date();

  return locales.flatMap((locale) =>
    publicPaths.map((path) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? "weekly" : "monthly",
      priority: path === "" ? 1 : path === "/order" ? 0.9 : 0.7,
    })),
  );
}
