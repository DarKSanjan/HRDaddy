import type { NextConfig } from "next";

// Supabase project origin, needed in connect-src for auth/storage calls made
// directly from the browser. Falls back to allowing any *.supabase.co so a
// missing env var at build time doesn't silently produce a CSP that blocks
// the app outright — the app still fails closed on everything else.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';

const csp = [
  "default-src 'self'",
  // Next.js's own bootstrap/hydration scripts are inline; a nonce-based CSP
  // is a larger follow-up, not attempted in this pass.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  experimental: {
    serverActions: {
      // The app's own document-upload limit is 25MB (src/modules/documents/schemas.ts);
      // this just needs headroom above it so that check is what actually enforces the cap.
      bodySizeLimit: '26mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
