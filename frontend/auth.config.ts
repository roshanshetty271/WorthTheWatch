/**
 * Worth the Watch? — Auth.js Base Config
 * Edge-compatible configuration (no database imports).
 * Used by middleware.ts for route protection.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/auth/signin",
    },
    providers: [], // Configured in auth.ts (not here — edge can't import adapters)
    callbacks: {
        // Add user ID to the session so we can use it in API routes
        session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            return session;
        },
        // Allow all users to access all pages (no route protection needed)
        authorized({ auth }) {
            return true; // App works for anonymous users too
        },
    },
} satisfies NextAuthConfig;