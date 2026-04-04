import type { Metadata } from "next";
import { neon } from "@neondatabase/serverless";
import { auth } from "@/auth";
import PublicListPage from "@/components/PublicListPage";

const SITE_URL = "https://worth-the-watch.com";

interface Props {
    params: Promise<{ listId: string }>;
}

async function getListMeta(listId: string, userId: string | undefined) {
    try {
        const sql = neon(process.env.DATABASE_URL!);
        const rows = await sql`
            SELECT name, description, is_public, user_id FROM user_lists WHERE id = ${listId}
        `;
        if (rows.length === 0) return null;

        const list = rows[0];
        const isPublic = list.is_public;
        const isOwner = userId != null && list.user_id === userId;

        if (!isPublic && !isOwner) return null;

        const itemCount = await sql`
            SELECT COUNT(*) as total FROM user_list_items WHERE list_id = ${listId}
        `;

        return {
            name: list.name as string,
            description: list.description as string | null,
            itemCount: parseInt((itemCount[0] as Record<string, string>)?.total || "0", 10),
        };
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { listId } = await params;
    const session = await auth();
    const list = await getListMeta(listId, session?.user?.id);

    if (!list) {
        return { title: "List Not Found | Worth the Watch?" };
    }

    const title = `${list.name} — ${list.itemCount} picks | Worth the Watch?`;
    const description = list.description
        || `A curated watchlist of ${list.itemCount} movies and shows on Worth the Watch.`;

    return {
        title,
        description,
        openGraph: {
            title: list.name,
            description,
            siteName: "Worth the Watch?",
            type: "website",
            url: `${SITE_URL}/list/${listId}`,
            images: [{ url: "/twitter-share.jpg", width: 1200, height: 630 }],
        },
        twitter: {
            card: "summary_large_image",
            title: list.name,
            description,
            images: ["/twitter-share.jpg"],
        },
    };
}

export default async function ListPage({ params }: Props) {
    const { listId } = await params;
    return <PublicListPage listId={listId} />;
}
