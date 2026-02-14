/**
 * Worth the Watch? — Auth.js Configuration
 * Google OAuth + Neon PostgreSQL adapter.
 * 
 * Uses JWT strategy for edge compatibility.
 * Pool created inside handler (Neon serverless requirement).
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import NeonAdapter from "@auth/neon-adapter";
import { Pool } from "@neondatabase/serverless";
import { authConfig } from "@/auth.config";

// CRITICAL: Pool must be created inside the handler function.
// Neon serverless cannot keep connections alive between requests.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    return {
        ...authConfig,
        adapter: NeonAdapter(pool),
        session: {
            strategy: "jwt", // JWT for edge compatibility
            maxAge: 30 * 24 * 60 * 60, // 30 days
        },
        providers: [
            Google({
                clientId: process.env.AUTH_GOOGLE_ID,
                clientSecret: process.env.AUTH_GOOGLE_SECRET,
                // Request minimal scopes
                authorization: {
                    params: {
                        prompt: "consent",
                        access_type: "offline",
                        response_type: "code",
                    },
                },
            }),
        ],
        callbacks: {
            ...authConfig.callbacks,
            // Persist user ID in JWT token
            jwt({ token, user }) {
                if (user?.id) {
                    token.sub = user.id;
                }
                return token;
            },
            session({ session, token }) {
                if (session.user && token.sub) {
                    session.user.id = token.sub;
                }
                return session;
            },
        },
    };
});