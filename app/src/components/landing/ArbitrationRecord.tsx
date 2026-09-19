import { createHash } from "node:crypto";
import { SAMPLE_RECORD, recordPayload } from "@/lib/sampleRecord";

/**
 * The record is paper. Everything human (the filings, the reasoning, the stamp)
 * sits on a document; everything mechanical lives on the dark vault.
 *
 * The fingerprint is computed here at build time from the same payload the
 * live verifier hashes, so the 64 characters on this page are the real SHA-256
 * of the record above it, not decoration.
 */
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export function ArbitrationRecord() {
  const r = SAMPLE_RECORD;
  const fingerprint = createHash("sha256").update(recordPayload(r)).digest("hex");

  return (
    <article className="paper rounded-[6px] overflow-hidden">
      <header className="px-6 sm:px-8 pt-7 pb-5 border-b border-ink/15">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-ink/65">Record of arbitration</p>
          <span className="text-xs border border-ink/30 rounded-full px-2.5 py-0.5 text-ink/65">
            Example
          </span>
        </div>
        <p className="addr text-[11px] text-ink/55 mt-1.5 break-all">{r.escrow}</p>
        <p className="font-display text-[1.7rem] leading-snug mt-4">
          Agreed work: {lowerFirst(r.description.replace(/\.$/, ""))}. 1.00 SOL held.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 sm:divide-x divide-ink/15 border-b border-ink/15">
        <div className="px-6 sm:px-8 py-5">
          <p className="text-xs text-ink/60">Client filed</p>
          <p className="mt-1.5 leading-relaxed">{r.client_evidence}</p>
        </div>
        <div className="px-6 sm:px-8 py-5 border-t border-ink/15 sm:border-t-0">
          <p className="text-xs text-ink/60">Expert filed</p>
          <p className="mt-1.5 leading-relaxed">{r.expert_evidence}</p>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-6">
        <p className="text-[0.95rem] leading-relaxed text-ink/80">{r.reasoning}</p>

        <div className="mt-6 pt-5 border-t border-ink/15 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0 basis-[16rem] grow">
            <p className="text-xs text-ink/60">Fingerprint written on-chain</p>
            <p className="addr text-[11px] leading-relaxed mt-1.5 break-all text-ink/85">
              {fingerprint}
            </p>
          </div>
          <div className="shrink-0 -rotate-[6deg] border-2 border-[#17714d] text-[#17714d] rounded-[3px] px-4 py-2 mix-blend-multiply">
            <p className="font-display text-xl leading-none">Released to expert</p>
          </div>
        </div>
      </div>
    </article>
  );
}
