// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d61242c7e5bca4b64b15d00f9422600f@o4511171874979840.ingest.us.sentry.io/4511171880353792",

  // 5%, not the wizard's 100%. Every sampled trace costs CPU on a server that
  // bills by Active CPU, and 1-in-20 is plenty to spot a slow route. Raise it
  // temporarily when actually chasing a performance bug.
  tracesSampleRate: 0.05,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
