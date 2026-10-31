import type { NextConfig } from "next";

// Dodatkowa warstwa obrony przeciw XSS (np. innerHTML w VariableInserter):
// blokuje ładowanie skryptów z obcych domen nawet gdyby złośliwy HTML wylądował
// na stronie. `script-src` musi mieć 'unsafe-inline' — Next.js App Router (RSC
// bootstrap + dev hot-reloader) wstrzykuje własne inline <script> tagi bez
// nonce'a; bez tego strona w ogóle się nie hydratuje (sprawdzone na żywo).
// Docelowo: przejść na CSP z nonce per-request generowanym w proxy.ts, żeby
// script-src mógł być bez 'unsafe-inline' — to osobna, większa zmiana.
// 'unsafe-eval' TYLKO w dev — React Fast Refresh używa eval() do podmiany
// modułów na żywo; produkcyjny build tego nie potrzebuje.
const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://cdn.discordapp.com https://static-cdn.jtvnw.net",
  "font-src 'self' data:",
  "connect-src 'self' https://discord.com https://cdn.discordapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Na produkcji (HTTPS za Nginxem) każde przypadkowe http:// podnosimy do https://.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Okno otwarte z innej strony nie dostaje referencji do panelu (window.opener) i odwrotnie.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Bez nagłówka "X-Powered-By: Next.js" - nie podpowiadamy skanerom, na czym stoi panel.
  poweredByHeader: false,
  // Natywna paczka (Skia) - ładowana z node_modules w runtime, nie pakowana przez bundler.
  serverExternalPackages: ["@napi-rs/canvas"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "static-cdn.jtvnw.net",
      },
    ],
  },
};

export default nextConfig;
