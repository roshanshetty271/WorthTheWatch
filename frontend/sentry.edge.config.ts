// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d61242c7e5bca4b64b15d00f9422600f@o4511171874979840.ingest.us.sentry.io/4511171880353792",

  // Tracing is OFF on the edge. This config wraps middleware, which runs on
  // every single request to the site, so anything done here is paid for once
  // per request in Fluid Active CPU. The wizard default of 1 (100%) is what
  // exhausted the Hobby CPU allowance on 2026-10-30 and paused the project.
  // Errors are still captured — only performance spans are dropped.
  tracesSampleRate: 0,

  // Same reasoning: log shipping on the hottest path isn't worth the CPU.
  enableLogs: false,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
