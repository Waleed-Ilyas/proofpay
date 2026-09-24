"use client";

import { useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/hooks/useNotifications";
import { formatWhen, shorten } from "@/components/app/ui";

const TONE_DOT: Record<NotificationItem["tone"], string> = {
    flare: "bg-flare",
    brass: "bg-brass",
    verdict: "bg-verdict",
};

export function NotificationBell({
    items,
    unreadCount,
    loading,
    onOpen,
    onSelect,
}: {
    items: NotificationItem[];
    unreadCount: number;
    loading: boolean;
    /** Called the moment the dropdown opens — this is what marks everything as read. */
    onOpen: () => void;
    /** Called when a specific notification is clicked, with its escrow address. */
    onSelect: (escrowAddress: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        function onEscape(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onClickOutside);
        document.addEventListener("keydown", onEscape);
        return () => {
            document.removeEventListener("mousedown", onClickOutside);
            document.removeEventListener("keydown", onEscape);
        };
    }, []);

    function toggle() {
        const next = !open;
        setOpen(next);
        if (next) onOpen();
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={toggle}
                aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
                aria-expanded={open}
                className="relative grid place-items-center size-10 shrink-0 rounded-lg border border-edge text-mute transition-colors hover:text-bone hover:border-brass"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                        d="M12 3a5 5 0 0 0-5 5v3.2c0 .7-.25 1.37-.7 1.9L5 15h14l-1.3-1.9a3 3 0 0 1-.7-1.9V8a5 5 0 0 0-5-5Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                    />
                    <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-flare text-night text-[10px] font-semibold grid place-items-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] max-h-[26rem] overflow-y-auto rounded-xl border border-edge bg-surface shadow-2xl z-50"
                >
                    <div className="px-4 py-3 border-b border-edge sticky top-0 bg-surface">
                        <p className="font-display text-lg leading-none">Notifications</p>
                    </div>

                    {loading && items.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-mute text-center">Checking…</p>
                    ) : items.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-mute text-center">Nothing new.</p>
                    ) : (
                        <ul className="divide-y divide-edge">
                            {items.map((n) => (
                                <li key={n.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOpen(false);
                                            onSelect(n.escrowAddress);
                                        }}
                                        className="w-full text-left px-4 py-3 transition-colors hover:bg-raised/40"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <span
                                                className={`mt-1.5 size-1.5 rounded-full shrink-0 ${TONE_DOT[n.tone]}`}
                                                aria-hidden="true"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm leading-snug text-bone">{n.message}</p>
                                                {n.detail && (
                                                    <p className="text-xs text-mute mt-0.5">{n.detail}</p>
                                                )}
                                                <p className="text-[11px] text-mute/70 mt-1 addr">
                                                    {formatWhen(n.at)} · {shorten(n.escrowAddress)}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
