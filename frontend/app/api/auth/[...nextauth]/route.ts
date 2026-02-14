/**
 * Worth the Watch? — Auth API Route
 * Handles all /api/auth/* requests (signin, signout, callback, etc.)
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;