import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geist via next/font já usa font-display:swap automaticamente (next/font internamente)
  // Não há <img> no projeto — Avatar é textual, ícones são SVG via @tabler/icons-react
  // Bundle-analyzer disponível via ANALYZE=true (npm run build com @next/bundle-analyzer)
};

export default nextConfig;
