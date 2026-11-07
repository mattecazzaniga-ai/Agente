import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // i loghi degli sponsor si caricano dal pannello admin (fino a 2 MB)
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // il font delle immagini da condividere si legge dal disco: va incluso nelle funzioni
  outputFileTracingIncludes: { "/api/immagine/**": ["./assets/font/*.woff", "./assets/brand/logo-640.png"] },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
