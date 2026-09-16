"use client";

import { useState } from "react";

export default function ResolveWithAiButton({
    escrowAddress,
    onResolved,
}: {
    escrowAddress: string;
    onResolved: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/resolve-dispute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ escrowAddress }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error ?? "Resolution failed");
            }

            onResolved();
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "Something went wrong resolving the dispute.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mt-2">
            <button
                onClick={handleClick}
                disabled={loading}
                className="px-3 py-2 rounded-md bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-sm font-medium"
            >
                {loading ? "Asking AI to resolve..." : "Resolve with AI"}
            </button>
            {error && <p className="text-xs text-red-400 mt-1 break-all">{error}</p>}
        </div>
    );
}