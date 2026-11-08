import type { MetadataRoute } from "next";
import { indirizzoSito } from "@/lib/sito";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sito = await indirizzoSito();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*/admin", "/*/profilo", "/*/notifiche", "/*/benvenuto", "/auth/"] },
    sitemap: `${sito}/sitemap.xml`,
  };
}
