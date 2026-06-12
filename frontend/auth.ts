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
        events: {
            // Fires once, when the adapter first creates the user (i.e. first sign-in).
            // Best-effort: a failure here must never break the sign-in flow.
            async createUser({ user }) {
                try {
                    if (!user?.id) return;

                    // 1) Welcome email
                    if (user.email) {
                        const { sendWelcomeEmail } = await import("@/lib/email");
                        await sendWelcomeEmail(user.email, user.name, user.id);
                    }

                    // 2) In-app welcome notification (lights up the bell)
                    const { neon } = await import("@neondatabase/serverless");
                    const sql = neon(process.env.DATABASE_URL!);
                    await sql`
                        CREATE TABLE IF NOT EXISTS notifications (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID NOT NULL,
                            type VARCHAR(30) NOT NULL,
                            title TEXT NOT NULL,
                            body TEXT,
                            tmdb_id INTEGER,
                            read BOOLEAN DEFAULT false,
                            created_at TIMESTAMP DEFAULT NOW()
                        )
                    `;
                    const welcomeBody =
                        "Save movies to your list and we'll tell you the moment they're worth it. " +
                        "You're set for the monthly Worth-It digest — change anytime in your profile.";
                    await sql`
                        INSERT INTO notifications (user_id, type, title, body)
                        VALUES (${user.id}, 'welcome', ${"Welcome to Worth the Watch! 🍿"}, ${welcomeBody})
                    `;
                } catch (err) {
                    console.error("createUser event failed (non-blocking):", err);
                }
            },
        },
    };
});