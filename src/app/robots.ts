import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://ghasilak.example";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ar", "/en", "/ar/pricing", "/en/pricing", "/ar/services", "/en/services", "/ar/areas", "/en/areas", "/ar/how-it-works", "/en/how-it-works", "/ar/faq", "/en/faq", "/ar/contact", "/en/contact"],
        disallow: [
          "/ar/admin",
          "/en/admin",
          "/ar/driver",
          "/en/driver",
          "/ar/orders",
          "/en/orders",
          "/ar/profile",
          "/en/profile",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
