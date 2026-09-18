/**
 * The "how it works" beat, shown rather than described: a ledger of where the
 * 1.00 SOL physically sits at each state of the escrow, and who can move it.
 * The point the table makes is the third column, which reads "nobody" for most
 * of the life of the job.
 */
const rows = [
    {
        state: "Awaiting acceptance",
        holds: "Escrow account",
        canMove: "Client, by cancelling",
        tone: "text-brass",
    },
    {
        state: "Active",
        holds: "Escrow account",
        canMove: "Nobody, until someone acts",
        tone: "text-brass",
    },
    {
        state: "Disputed",
        holds: "Escrow account",
        canMove: "Nobody, including us",
        tone: "text-flare",
    },
    {
        state: "Completed",
        holds: "Expert's wallet",
        canMove: "Settled",
        tone: "text-verdict",
    },
    {
        state: "Refunded",
        holds: "Client's wallet",
        canMove: "Settled",
        tone: "text-verdict",
    },
];

export function CustodyLedger() {
    return (
        <div className="border border-edge">
            <div className="grid grid-cols-[1fr_1fr_1.2fr] bg-raised text-bone">
                <span className="px-4 py-3 text-sm">Escrow state</span>
                <span className="px-4 py-3 text-sm">Who holds the SOL</span>
                <span className="px-4 py-3 text-sm">Who can move it</span>
            </div>
            {rows.map((r) => (
                <div
                    key={r.state}
                    className="grid grid-cols-[1fr_1fr_1.2fr] border-t border-edge"
                >
                    <span className={`px-4 py-3.5 text-sm font-medium ${r.tone}`}>
                        {r.state}
                    </span>
                    <span className="px-4 py-3.5 text-sm text-mute">{r.holds}</span>
                    <span className="px-4 py-3.5 text-sm text-mute">{r.canMove}</span>
                </div>
            ))}
        </div>
    );
}