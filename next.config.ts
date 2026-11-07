import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // il font delle immagini da condividere si legge dal disco: va incluso nelle funzioni
  outputFileTracingIncludes: { "/api/immagine/**": ["./assets/font/*.woff"] },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
