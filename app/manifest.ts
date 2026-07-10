import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "Signal Wire",
    description: siteDescription(),
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#22a6b3",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
