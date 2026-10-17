/**
 * Response headers applied to every route.
 *
 * Defence in depth, not a fix for a live hole: the session cookie is
 * SameSite=Lax, so a cross-site frame of this console is already signed out
 * and can't be clickjacked into a Validate click. These make that true by
 * policy as well as by accident — a console with one-click, irreversible
 * decisions should refuse to be framed at all — and stop the browser from
 * second-guessing content types or leaking full URLs to other origins.
 *
 * The Content-Security-Policy is not here: it carries a new nonce on every
 * request, so middleware.ts sets it (src/lib/contentSecurityPolicy.ts).
 * Vercel already sends Strict-Transport-Security (the thesis's HSTS
 * requirement), so it isn't repeated.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The console uses notifications and audio, neither of which is governed
  // here; these three it never needs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Stops advertising the framework in every response.
  poweredByHeader: false,
  experimental: {
    // How long the browser keeps a visited page to show again at once,
    // instead of behind its loading skeleton. Next 14 keeps a dynamic page
    // for 30 s; every page here is dynamic, so going back to one after half
    // a minute always meant the skeleton. Three minutes covers moving
    // between pages while working, and is short enough that a page shown
    // from the cache is never far behind. The queue refreshes itself as soon
    // as it is back on screen, and every decision clears the whole cache.
    staleTimes: { dynamic: 180 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
