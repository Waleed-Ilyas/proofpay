"use client";

import { useEffect } from "react";

const AUTO_DISMISS_MS = 6000;

export interface ToastState {
    escrowAddress: string;
    message: string;
}

/**
 * A settling action (release, cancel, a ruling, a claimed timeout) used to
 * just make its card quietly vanish from Open — easy to miss entirely.
 * This is the explicit "yes, that actually happened" moment, with a direct
 * way to jump straight to the result instead of hunting for it.
 */
export function SettledToast({
    toast,
    onView,
    onDismiss,
}: {
    toast: ToastState | null;
    onView: (escrowAddress: string) => void;
    onDismiss: () => void;
}) {
    useEffect(() => {
        if (!toast) return;
        const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
        return () => clearTimeout(id);
    }, [toast, onDismiss]);

    if (!toast) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm rounded-xl border border-verdict/40 bg-surface shadow-2xl overflow-hidden pp-card-in"
        >
            <div className="flex items-start gap-3 p-4">
                <span className="mt-0.5 shrink-0 grid place-items-center size-6 rounded-full bg-verdict text-night">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                            d="M5 13l4 4L19 7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
                <div className="min-w-0 flex-1">
                    <p className="font-display text-lg leading-snug">Settled</p>
                    <p className="text-sm text-mute mt-0.5 leading-snug">{toast.message}</p>
                    <button
                        type="button"
                        onClick={() => {
                            onView(toast.escrowAddress);
                            onDismiss();
                        }}
                        className="mt-2 text-sm text-verdict underline underline-offset-4 hover:text-verdict/80"
                    >
                        View it
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="shrink-0 text-mute hover:text-bone transition-colors -mt-1 -mr-1 p-1"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}
