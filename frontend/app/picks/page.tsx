/**
 * /picks — merged into the Discover ("Genre Picks") page. Redirect to keep old
 * links/bookmarks working.
 */
import { redirect } from "next/navigation";

export default function Picks() {
    redirect("/discover");
}
