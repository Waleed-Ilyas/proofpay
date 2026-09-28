import type { AccountInfo, Commitment, Connection, PublicKey, RpcResponseAndContext } from "@solana/web3.js";

// Waits between resends: ~5 seconds in total, well inside the ~60 seconds a
// blockhash stays valid for.
const DEFAULT_RETRY_DELAYS_MS = [1000, 1500, 2500];

function isBlockhashNotFound(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /blockhash not found/i.test(message);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Solana's public devnet RPC sits behind a load balancer whose nodes don't
 * always agree on the latest blockhash. A transaction can be signed with a
 * blockhash one node handed out, then rejected by another node that hasn't
 * seen it yet ("Blockhash not found"). Nothing is wrong with the transaction
 * itself, and nothing was sent: the node simply hadn't caught up.
 *
 * This wraps a Connection so that sendRawTransaction() quietly resends the
 * SAME already-signed bytes a moment later when that specific error comes
 * back. That's safe (a rejected send never reached the network, and even a
 * repeat of the identical signed transaction can only land once) and it means
 * no second wallet approval, because nothing needs signing again. Every other
 * error, including a real program failure or the user rejecting the wallet
 * popup, is thrown straight through untouched.
 */
export function withBlockhashRetry(
    connection: Connection,
    retryDelaysMs: number[] = DEFAULT_RETRY_DELAYS_MS
): Connection {
    return new Proxy(connection, {
        get(target, prop) {
            if (prop === "sendRawTransaction") {
                return async (...args: Parameters<Connection["sendRawTransaction"]>) => {
                    let lastError: unknown;

                    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
                        try {
                            return await target.sendRawTransaction(...args);
                        } catch (err) {
                            if (!isBlockhashNotFound(err)) throw err;
                            lastError = err;
                            if (attempt < retryDelaysMs.length) {
                                await sleep(retryDelaysMs[attempt]);
                            }
                        }
                    }

                    console.error("Send kept failing with 'Blockhash not found':", lastError);
                    const friendly = new Error(
                        "The Solana network was slow to respond, so your transaction wasn't sent and nothing was charged. Please try again in a few seconds."
                    );
                    (friendly as Error & { cause?: unknown }).cause = lastError;
                    throw friendly;
                };
            }

            // Everything else passes straight through to the real connection,
            // bound to it so its internal state keeps working.
            const value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}


// ---------------------------------------------------------------------------
// Combining reads that happen at the same moment
// ---------------------------------------------------------------------------

type AccountResponse = RpcResponseAndContext<AccountInfo<Buffer> | null>;
type Waiter = {
    pubkey: PublicKey;
    resolve: (response: AccountResponse) => void;
    reject: (error: unknown) => void;
};

const MAX_ACCOUNTS_PER_REQUEST = 100; // the RPC's own limit for getMultipleAccounts
const COALESCE_WINDOW_MS = 15;

/**
 * Solana's public devnet RPC allows 40 requests per 10 seconds per IP for any
 * single method (and 100 overall). Loading the dashboard fires many account
 * reads at once (one per open dispute's timer, one per open dispute for the
 * notification bell, one verify pre-check per ruled escrow), and a few quick
 * reloads or open tabs is enough to cross 40. web3.js then logs "Server
 * responded with 429 ... Retrying" and backs off.
 *
 * This waits a few milliseconds and sends every account read that arrived in
 * that window as ONE getMultipleAccounts request instead of one request each.
 * Callers still get their own result, exactly as if they'd asked alone, so
 * nothing else in the app has to change. A read that's alone in its window is
 * sent as the same single request it always was.
 *
 * Only plain reads are combined (no options object, and only reads at the
 * same commitment level are ever mixed); anything more specific goes straight
 * through untouched.
 */
export function withReadCoalescing(
    connection: Connection,
    windowMs: number = COALESCE_WINDOW_MS
): Connection {
    const groups = new Map<string, { commitment: Commitment | undefined; waiters: Waiter[] }>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchGroup(commitment: Commitment | undefined, waiters: Waiter[]) {
        // Callers asking for the same address share one slot in the request.
        const byAddress = new Map<string, Waiter[]>();
        for (const waiter of waiters) {
            const key = waiter.pubkey.toBase58();
            const existing = byAddress.get(key);
            if (existing) existing.push(waiter);
            else byAddress.set(key, [waiter]);
        }
        const entries = [...byAddress.values()];

        if (entries.length === 1) {
            // Nothing to combine: make exactly the request the caller would have.
            const list = entries[0];
            try {
                const response = await connection.getAccountInfoAndContext(list[0].pubkey, commitment);
                list.forEach((w) => w.resolve(response));
            } catch (err) {
                list.forEach((w) => w.reject(err));
            }
            return;
        }

        for (let i = 0; i < entries.length; i += MAX_ACCOUNTS_PER_REQUEST) {
            const chunk = entries.slice(i, i + MAX_ACCOUNTS_PER_REQUEST);
            try {
                const response = await connection.getMultipleAccountsInfoAndContext(
                    chunk.map((list) => list[0].pubkey),
                    commitment
                );
                chunk.forEach((list, index) => {
                    const single: AccountResponse = {
                        context: response.context,
                        value: response.value[index] ?? null,
                    };
                    list.forEach((w) => w.resolve(single));
                });
            } catch (err) {
                chunk.forEach((list) => list.forEach((w) => w.reject(err)));
            }
        }
    }

    function flush() {
        timer = null;
        const pending = [...groups.values()];
        groups.clear();
        for (const group of pending) void fetchGroup(group.commitment, group.waiters);
    }

    function request(pubkey: PublicKey, commitment: Commitment | undefined): Promise<AccountResponse> {
        return new Promise<AccountResponse>((resolve, reject) => {
            const key = commitment ?? "";
            let group = groups.get(key);
            if (!group) {
                group = { commitment, waiters: [] };
                groups.set(key, group);
            }
            group.waiters.push({ pubkey, resolve, reject });
            if (!timer) timer = setTimeout(flush, windowMs);
        });
    }

    return new Proxy(connection, {
        get(target, prop) {
            if (prop === "getAccountInfoAndContext" || prop === "getAccountInfo") {
                const wantsContext = prop === "getAccountInfoAndContext";
                return (publicKey: PublicKey, commitmentOrConfig?: unknown) => {
                    if (commitmentOrConfig !== undefined && typeof commitmentOrConfig !== "string") {
                        // Has an options object: not something to combine.
                        return (target as any)[prop](publicKey, commitmentOrConfig);
                    }
                    const pending = request(publicKey, commitmentOrConfig as Commitment | undefined);
                    return wantsContext ? pending : pending.then((response) => response.value);
                };
            }

            const value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}

/** Everything the app wants from its connection: resilient sends, and reads
 *  that don't pile up on the shared RPC. */
export function resilientConnection(connection: Connection): Connection {
    return withReadCoalescing(withBlockhashRetry(connection));
}
