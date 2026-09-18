/**
 * The hero visual is the product's own output: one finished arbitration
 * record, assembling in four beats: the case, both filings, the ruling, the
 * fingerprint. Groups animate together; individual labels never animate alone.
 *
 * These values are a real dispute from devnet testing. Replace the hash with
 * the one in your dispute_resolutions table before shipping, rather than
 * leaving an example on a page that argues for verifiability.
 */
export function ArbitrationRecord() {
    return (
        <div className="relative">
            <article className="rec-sheet bg-surface border border-edge">
                {/* Beat 1: the case */}
                <header className="px-6 pt-6 pb-5 border-b border-edge">
                    <p className="text-sm text-mute">Record of arbitration</p>
                    <p className="addr text-xs text-mute mt-1.5 scroll-x whitespace-nowrap">
                        24BkUYBnM6qAAnFXRLCKfeTGyZ71DXFSXnAtNkxsKwVp
                    </p>
                    <p className="font-display text-xl leading-snug mt-4">
                        Agreed work: build a Power BI dashboard. 1.00 SOL held.
                    </p>
                </header>

                {/* Beat 2: both filings, as one group */}
                <div
                    className="rec-line grid grid-cols-2 border-b border-edge"
                    style={{ animationDelay: "420ms" }}
                >
                    <div className="px-5 py-4 border-r border-edge">
                        <p className="text-xs text-mute">Client filed</p>
                        <p className="text-sm leading-relaxed mt-1.5">
                            The expert used AI tools. I wanted the work done by hand.
                        </p>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-xs text-mute">Expert filed</p>
                        <p className="text-sm leading-relaxed mt-1.5">
                            All three report pages were delivered as specified.
                        </p>
                    </div>
                </div>

                {/* Beat 3: the reasoning, arriving with the stamp */}
                <div className="px-6 py-5">
                    <p
                        className="rec-line text-sm leading-relaxed text-mute"
                        style={{ animationDelay: "800ms" }}
                    >
                        The agreed terms set no requirement about how the work was produced.
                        The deliverable met the stated scope.
                    </p>

                    {/* Beat 4: the fingerprint */}
                    <div className="mt-5 pt-4 border-t border-edge">
                        <p className="text-xs text-mute">Fingerprint written on-chain</p>
                        <p
                            className="rec-hash addr text-xs mt-1.5 scroll-x whitespace-nowrap"
                            style={{ animationDelay: "1250ms" }}
                        >
                            8f3ac91b7e2d4a6058fc1e9b3d7a24e0d21c
                        </p>
                    </div>
                </div>
            </article>

            {/* The one intentional rule-break: the ruling sits off-grid and bleeds
          past the record's right edge. Overshoot appears once, here, because
          stamping is a physical action rather than a UI state change. */}
            <div
                className="rec-stamp absolute -right-3 sm:-right-8 top-40 border-2 border-verdict bg-raised px-4 py-2"
                style={{ animationDelay: "860ms" }}
            >
                <p className="font-display text-lg text-verdict leading-none">
                    Released to expert
                </p>
            </div>
        </div>
    );
}