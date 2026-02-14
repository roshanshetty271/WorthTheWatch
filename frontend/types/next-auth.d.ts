/**
 * Worth the Watch? — Auth.js Type Extensions
 * Adds user.id to the session type so TypeScript knows about it.
 */
import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
        } & DefaultSession["user"];
    }
}