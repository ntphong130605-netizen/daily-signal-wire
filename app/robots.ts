import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/login", "/api/admin", "/api/cron"]
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl()
  };
}
