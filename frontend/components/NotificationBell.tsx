"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Notification {
    id: string;
    type: string;
    title: string;
    body: string | null;
    tmdb_id: number | null;
    read: boolean;
    created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
    verdict_refreshed: "🔄",
    new_review_for_saved: "⚡",
    welcome: "👋",
    milestone: "🏆",
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

export default function NotificationBell() {
    const { data: session } = useSession();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications");
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch {}
    }, []);

    useEffect(() => {
        if (!session?.user) return;
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [session, fetchNotifications]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markRead = async (notificationId: string) => {
        await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_id: notificationId }),
        }).catch(() => {});
        setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const markAllRead = async () => {
        await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mark_all_read: true }),
        }).catch(() => {});
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    if (!session?.user) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative p-2 text-white/60 hover:text-white transition-colors"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-gold text-[9px] font-bold text-black">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-surface-card border border-white/10 shadow-2xl z-50 overflow-hidden animate-fade-in">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <h3 className="text-sm font-bold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-[10px] text-accent-gold hover:text-accent-goldLight uppercase tracking-wider font-medium transition-colors"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-2xl mb-2">🔔</p>
                                <p className="text-xs text-text-muted">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((n) => {
                                const icon = TYPE_ICONS[n.type] || "📢";
                                const content = (
                                    <div
                                        className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 cursor-pointer ${!n.read ? "bg-accent-gold/5" : ""}`}
                                        onClick={() => {
                                            if (!n.read) markRead(n.id);
                                            setShowDropdown(false);
                                        }}
                                    >
                                        <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs leading-snug ${!n.read ? "text-white font-medium" : "text-text-secondary"}`}>
                                                {n.title}
                                            </p>
                                            {n.body && (
                                                <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">
                                                    {n.body}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-white/20 mt-1">{timeAgo(n.created_at)}</p>
                                        </div>
                                        {!n.read && (
                                            <span className="w-2 h-2 rounded-full bg-accent-gold flex-shrink-0 mt-1.5" />
                                        )}
                                    </div>
                                );

                                return n.tmdb_id ? (
                                    <Link key={n.id} href={`/movie/${n.tmdb_id}`}>
                                        {content}
                                    </Link>
                                ) : (
                                    <div key={n.id}>{content}</div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
