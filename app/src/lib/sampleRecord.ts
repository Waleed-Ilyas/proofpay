// One example arbitration record, shared by the static document and the live
// verifier. The payload key order matches src/app/api/resolve-dispute/route.ts
// exactly, because JSON.stringify order changes the hash.
export type RecordFields = {
  escrow: string;
  favor_expert: boolean;
  reasoning: string;
  description: string;
  client_evidence: string;
  expert_evidence: string;
};

export const SAMPLE_RECORD: RecordFields = {
  escrow: "24BkUYBnM6qAAnFXRLCKfeTGyZ71DXFSXnAtNkxsKwVp",
  favor_expert: true,
  reasoning:
    "The agreed terms set no requirement about how the work was produced. The deliverable met the stated scope.",
  description: "Build a Power BI dashboard.",
  client_evidence: "The expert used AI tools. I wanted the work done by hand.",
  expert_evidence: "All three report pages were delivered as specified.",
};

export function recordPayload(r: RecordFields): string {
  return JSON.stringify({
    escrow: r.escrow,
    favor_expert: r.favor_expert,
    reasoning: r.reasoning,
    description: r.description,
    client_evidence: r.client_evidence,
    expert_evidence: r.expert_evidence,
  });
}

export async function hashRecord(r: RecordFields): Promise<string> {
  const data = new TextEncoder().encode(recordPayload(r));
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
