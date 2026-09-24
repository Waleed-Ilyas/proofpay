"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { btn, inputClass } from "@/components/app/ui";

const DISMISS_PREFIX = "proofpay:emailPrompt:dismissed:";

function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/**
 * A one-time, dismissible prompt to save an email for dispute alerts. One
 * email per wallet, reused for every escrow that wallet is ever part of —
 * either side of a dispute might end up being the one who needs notifying.
 */
export function EmailOptIn({ wallet }: { wallet: string }) {
    const [savedEmail, setSavedEmail] = useState<string | null>(null);
    const [checked, setChecked] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (typeof window !== "undefined") {
            setDismissed(window.localStorage.getItem(DISMISS_PREFIX + wallet) === "1");
        }

        supabase
            .from("wallet_emails")
            .select("email")
            .eq("wallet_address", wallet)
            .maybeSingle()
            .then(({ data, error: fetchError }: { data: { email?: string } | null; error: unknown }) => {
                if (cancelled) return;
                if (fetchError) console.error("Failed to load saved email:", fetchError);
                setSavedEmail((data as { email?: string } | null)?.email ?? null);
                setChecked(true);
            });

        return () => {
            cancelled = true;
        };
    }, [wallet]);

    function dismiss() {
        window.localStorage.setItem(DISMISS_PREFIX + wallet, "1");
        setDismissed(true);
    }

    async function save() {
        setError(null);
        if (!isValidEmail(value)) {
            setError("Enter a valid email address.");
            return;
        }
        setSaving(true);
        try {
            const { error: upsertError } = await supabase
                .from("wallet_emails")
                .upsert({ wallet_address: wallet, email: value.trim() }, { onConflict: "wallet_address" });
            if (upsertError) throw new Error(upsertError.message);
            setSavedEmail(value.trim());
            setEditing(false);
        } catch (err: any) {
            setError(err.message ?? "Couldn't save that. Try again.");
        } finally {
            setSaving(false);
        }
    }

    if (!checked) return null;

    // Already saved, and not currently editing: a quiet one-liner, not a banner.
    if (savedEmail && !editing) {
        return (
            <p className="text-xs text-mute">
                Dispute email alerts on for{" "}
                <span className="text-bone">{savedEmail}</span>.{" "}
                <button
                    type="button"
                    onClick={() => {
                        setValue(savedEmail);
                        setEditing(true);
                    }}
                    className="underline underline-offset-4 hover:text-brass"
                >
                    Change
                </button>
            </p>
        );
    }

    if (!savedEmail && dismissed && !editing) return null;

    return (
        <div className="rounded-xl border border-edge bg-surface p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-mute flex-1 sm:min-w-[16rem]">
                {editing
                    ? "Update the email used for dispute alerts."
                    : "Get an email if a dispute is raised against you on any of your escrows."}
            </p>
            <div className="flex items-center gap-2">
                <input
                    type="email"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="you@example.com"
                    className={`${inputClass} w-56`}
                    disabled={saving}
                />
                <button onClick={save} disabled={saving} className={btn.primary}>
                    {saving ? "Saving…" : "Save"}
                </button>
                {!editing && (
                    <button onClick={dismiss} className={btn.quiet}>
                        Not now
                    </button>
                )}
                {editing && (
                    <button onClick={() => setEditing(false)} className={btn.quiet}>
                        Cancel
                    </button>
                )}
            </div>
            {error && <p className="text-xs text-flare basis-full">{error}</p>}
        </div>
    );
}
