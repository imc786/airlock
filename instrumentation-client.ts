import posthog from "posthog-js";

// Cookieless, production-only (Vercel-injected NEXT_PUBLIC_VERCEL_ENV), inert without a key; forks and previews send nothing.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

if (key && host && isProduction) {
  posthog.init(key, {
    api_host: host,
    persistence: "memory",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
  });
}
