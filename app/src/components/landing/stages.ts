// One source of truth for the five moments of an escrow. The hero card and the
// scroll story both read from here, and both drive the same 3D vault by index.

export const TONE = {
  brass: { text: "text-brass", dot: "bg-brass", pill: "bg-brass text-night", bar: "bg-brass", edge: "border-brass" },
  flare: { text: "text-flare", dot: "bg-flare", pill: "bg-flare text-night", bar: "bg-flare", edge: "border-flare" },
  signal: { text: "text-signal", dot: "bg-signal", pill: "bg-signal text-night", bar: "bg-signal", edge: "border-signal" },
  verdict: { text: "text-verdict", dot: "bg-verdict", pill: "bg-verdict text-night", bar: "bg-verdict", edge: "border-verdict" },
} as const;

export type Tone = keyof typeof TONE;

export type Stage = {
  /** short label for the hero card */
  short: string;
  detail: string;
  tone: Tone;
  /** scroll-story chapter */
  state: string;
  title: string;
  body: string;
  holds: string;
  moves: string;
};

export const STAGES: Stage[] = [
  {
    short: "Client deposits",
    detail: "1.00 SOL locked on-chain",
    tone: "brass",
    state: "Awaiting acceptance",
    title: "Sealed, waiting for a yes",
    body: "The client creates the escrow and the SOL goes straight into the program. The expert hasn't accepted yet, so the client can still cancel and take all of it back.",
    holds: "Escrow account",
    moves: "The client, by cancelling",
  },
  {
    short: "Expert accepts",
    detail: "The job is live. The SOL stays put.",
    tone: "brass",
    state: "Active",
    title: "Locked while the work happens",
    body: "The expert accepts and the work begins. The SOL stays in the escrow account. The client can release it when they're happy, or either side can raise a dispute.",
    holds: "Escrow account",
    moves: "The client, by releasing, or a ruling or timeout if disputed",
  },
  {
    short: "Dispute raised",
    detail: "Both sides file evidence",
    tone: "flare",
    state: "Disputed",
    title: "The door splits. A 12-hour clock starts.",
    body: "Either side raises a dispute, and both file what was agreed, what happened, and any screenshots that show it. The SOL is still in the escrow account. If both sides respond, the AI arbitrator rules; if one side goes silent for 12 hours, the other can claim the funds directly, no ruling needed.",
    holds: "Escrow account",
    moves: "A ruling once both sides respond, or a claim after 12 hours of silence",
  },
  {
    short: "Arbitrator rules",
    detail: "Ruling signed, fingerprint on-chain",
    tone: "signal",
    state: "The ruling",
    title: "A decision, signed and fingerprinted",
    body: "An AI arbitrator reads the terms, both filings and the attached images, then returns a decision with its reasoning. The record's SHA-256 fingerprint is written on-chain in the same transaction that moves the money.",
    holds: "Escrow account, until that transaction lands",
    moves: "The arbitrator's signed ruling",
  },
  {
    short: "Funds settled",
    detail: "SOL released to the winner's wallet",
    tone: "verdict",
    state: "Completed or Refunded",
    title: "Settled, and checkable forever",
    body: "The SOL lands in the winner's wallet: the expert if the work stood, the client if it didn't. The full record stays public, so anyone can recompute the fingerprint and compare.",
    holds: "The expert's wallet, or the client's",
    moves: "Nobody. It's settled.",
  },
];
